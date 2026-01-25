//! SFTP Channel 包装器
//!
//! 将 russh SSH channel 包装为 AsyncRead + AsyncWrite stream

use crate::error::{Result, SSHError};
use crate::ssh::backend::SftpStream;
use russh::client::{Handle, Msg};
use russh::{Channel, ChannelMsg};
use std::io::{self, Cursor};
use std::pin::Pin;
use std::task::{Context, Poll};
use tokio::io::{AsyncRead, AsyncWrite, ReadBuf};
use tokio::sync::mpsc;

/// SFTP Channel Stream
///
/// 包装 russh 的 SSH channel，实现 AsyncRead + AsyncWrite
/// 使用 mpsc channel 在后台任务和 AsyncRead/AsyncWrite 之间桥接
pub struct SftpChannelStream {
    // 接收端：从 SSH channel 读取的数据
    receiver: mpsc::UnboundedReceiver<Vec<u8>>,
    // 发送端：向 SSH channel 写入的数据
    sender: mpsc::UnboundedSender<Vec<u8>>,
    // 读取缓冲区
    read_buffer: Option<Vec<u8>>,
    read_pos: usize,
}

// Unpin 实现
impl Unpin for SftpChannelStream {}

impl SftpChannelStream {
    /// 创建新的 SFTP Channel Stream
    pub async fn open(handle: &Handle<crate::ssh::backends::russh::RusshHandler>) -> Result<Self> {
        // 打开新的 channel
        let channel = handle
            .channel_open_session()
            .await
            .map_err(|e| SSHError::ConnectionFailed(format!("Failed to open SFTP channel: {}", e)))?;

        // 请求 SFTP subsystem
        channel
            .request_subsystem(true, "sftp")
            .await
            .map_err(|e| SSHError::Ssh(format!("Failed to request SFTP subsystem: {}", e)))?;

        // 分离 channel 为读写两半
        let (mut read_half, write_half) = channel.split();

        // 创建 channels 用于桥接
        let (data_tx, data_rx) = mpsc::unbounded_channel::<Vec<u8>>();
        let (write_tx, mut write_rx) = mpsc::unbounded_channel::<Vec<u8>>();

        // 启动后台任务处理读取
        tokio::spawn(async move {
            loop {
                match read_half.wait().await {
                    Some(ChannelMsg::Data { data }) => {
                        let data_vec = data.to_vec();
                        if data_tx.send(data_vec).is_err() {
                            break; // 接收端已关闭
                        }
                    }
                    Some(ChannelMsg::Close) => {
                        break;
                    }
                    Some(_) => {
                        // 忽略其他消息
                    }
                    None => {
                        break;
                    }
                }
            }
        });

        // 启动后台任务处理写入
        tokio::spawn(async move {
            while let Some(data) = write_rx.recv().await {
                let mut cursor = Cursor::new(data);
                if write_half.data(&mut cursor).await.is_err() {
                    break;
                }
            }
        });

        Ok(Self {
            receiver: data_rx,
            sender: write_tx,
            read_buffer: None,
            read_pos: 0,
        })
    }
}

impl SftpStream for SftpChannelStream {
    fn as_any_mut(&mut self) -> &mut dyn std::any::Any {
        self
    }
}

impl AsyncRead for SftpChannelStream {
    fn poll_read(
        mut self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &mut ReadBuf<'_>,
    ) -> Poll<io::Result<()>> {
        // 如果当前缓冲区还有数据，先消费
        let buffer_len = self.read_buffer.as_ref().map(|b| b.len());
        let read_pos = self.read_pos;

        if let Some(len) = buffer_len {
            if read_pos < len {
                // 获取数据（需要先克隆，因为后面需要可变借用）
                let buffer = self.read_buffer.clone().unwrap();
                let remaining = &buffer[read_pos..];
                let to_copy = std::cmp::min(remaining.len(), buf.capacity());
                buf.put_slice(&remaining[..to_copy]);
                self.read_pos += to_copy;

                if self.read_pos >= len {
                    self.read_buffer = None;
                    self.read_pos = 0;
                }
                return Poll::Ready(Ok(()));
            }
        }

        // 尝试从 channel 接收新数据
        match self.receiver.poll_recv(cx) {
            Poll::Ready(Some(data)) => {
                let to_copy = std::cmp::min(data.len(), buf.capacity());
                buf.put_slice(&data[..to_copy]);

                if data.len() > to_copy {
                    self.read_buffer = Some(data);
                    self.read_pos = to_copy;
                }

                Poll::Ready(Ok(()))
            }
            Poll::Ready(None) => {
                // Channel 关闭
                Poll::Ready(Ok(()))
            }
            Poll::Pending => Poll::Pending,
        }
    }
}

impl AsyncWrite for SftpChannelStream {
    fn poll_write(
        self: Pin<&mut Self>,
        _cx: &mut Context<'_>,
        buf: &[u8],
    ) -> Poll<io::Result<usize>> {
        match self.sender.send(buf.to_vec()) {
            Ok(_) => Poll::Ready(Ok(buf.len())),
            Err(_) => Poll::Ready(Err(io::Error::new(
                io::ErrorKind::BrokenPipe,
                "Failed to write to channel",
            ))),
        }
    }

    fn poll_flush(self: Pin<&mut Self>, _cx: &mut Context<'_>) -> Poll<io::Result<()>> {
        Poll::Ready(Ok(()))
    }

    fn poll_shutdown(self: Pin<&mut Self>, _cx: &mut Context<'_>) -> Poll<io::Result<()>> {
        Poll::Ready(Ok(()))
    }
}
