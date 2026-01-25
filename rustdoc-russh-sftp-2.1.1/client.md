# 模块 client

Client side

**本模块包含 6 个项目**

## 子模块

- [client::error](client/error.md)
- [client::fs](client/fs.md)
 - Filesystem manipulation operations.
- [client::rawsession](client/rawsession.md)

## 结构体

### SftpSession

📦 **struct**

#### 定义

```rust
pub struct SftpSession { /* private fields */ }
```

#### 方法

```rust
pub async fn new<S>(stream: S) ->SftpResult<Self>where S: AsyncRead + AsyncWrite + Unpin + Send + 'static,
```

```rust
pub async fn new_opts<S>(stream: S, timeout: Option<u64>) ->SftpResult<Self>where S: AsyncRead + AsyncWrite + Unpin + Send + 'static,
```

```rust
pub async fn set_timeout (&self, secs: u64 )
```

```rust
pub async fn close (&self) ->SftpResult<()>
```

```rust
pub async fn open<T: Into<String>>(&self, filename: T) ->SftpResult<File>
```

```rust
pub async fn create<T: Into<String>>(&self, filename: T) ->SftpResult<File>
```

```rust
pub async fn open_with_flags<T: Into<String>>( &self, filename: T, flags: OpenFlags , ) ->SftpResult<File>
```

```rust
pub async fn open_with_flags_and_attributes<T: Into<String>>( &self, filename: T, flags: OpenFlags , attributes: FileAttributes , ) ->SftpResult<File>
```

```rust
pub async fn canonicalize<T: Into<String>>(&self, path: T) ->SftpResult<String>
```

```rust
pub async fn create_dir<T: Into<String>>(&self, path: T) ->SftpResult<()>
```

```rust
pub async fn read<P: Into<String>>(&self, path: P) ->SftpResult<Vec<u8>>
```

```rust
pub async fn write<P: Into<String>>( &self, path: P, data: &[ u8 ], ) ->SftpResult<()>
```

```rust
pub async fn try_exists<P: Into<String>>(&self, path: P) ->SftpResult<bool>
```

```rust
pub async fn read_dir<P: Into<String>>(&self, path: P) ->SftpResult<ReadDir>
```

```rust
pub async fn read_link<P: Into<String>>(&self, path: P) ->SftpResult<String>
```

```rust
pub async fn remove_dir<P: Into<String>>(&self, path: P) ->SftpResult<()>
```

```rust
pub async fn remove_file<T: Into<String>>(&self, filename: T) ->SftpResult<()>
```

```rust
pub async fn rename<O, N>(&self, oldpath: O, newpath: N) ->SftpResult<()>where O: Into<String>, N: Into<String>,
```

```rust
pub async fn symlink<P, T>(&self, path: P, target: T) ->SftpResult<()>where P: Into<String>, T: Into<String>,
```

```rust
pub async fn metadata<P: Into<String>>(&self, path: P) ->SftpResult<Metadata>
```

```rust
pub async fn set_metadata<P: Into<String>>( &self, path: P, metadata: Metadata , ) ->Result<() , Error>
```

```rust
pub async fn symlink_metadata<P: Into<String>>( &self, path: P, ) ->SftpResult<Metadata>
```

```rust
pub async fn hardlink<O, N>(&self, oldpath: O, newpath: N) ->SftpResult<bool>where O: Into<String>, N: Into<String>,
```

```rust
pub async fn fs_info<P: Into<String>>( &self, path: P, ) ->SftpResult<Option<Statvfs>>
```

---

## Trait

### Handler

✨ **trait**

#### 定义

```rust
pub trait Handler: Sized { type Error : Into<Error>; // Provided methods fn version ( &mut self, version: Version , ) ->impl Future<Output = Result<() , Self: : Error>>+ Send { ... } fn status ( &mut self, status: Status , ) ->impl Future<Output = Result<() , Self: : Error>>+ Send { ... } fn handle ( &mut self, handle: Handle , ) ->impl Future<Output = Result<() , Self: : Error>>+ Send { ... } fn data ( &mut self, data: Data , ) ->impl Future<Output = Result<() , Self: : Error>>+ Send { ... } fn name ( &mut self, name: Name , ) ->impl Future<Output = Result<() , Self: : Error>>+ Send { ... } fn attrs ( &mut self, attrs: Attrs , ) ->impl Future<Output = Result<() , Self: : Error>>+ Send { ... } fn extended_reply ( &mut self, reply: ExtendedReply , ) ->impl Future<Output = Result<() , Self: : Error>>+ Send { ... } }
```

---

## 函数

### run

🔧 **fn**

#### 定义

```rust
pub fn run<S, H>(stream: S, handler: H) ->UnboundedSender<Bytes>where S: AsyncRead + AsyncWrite + Unpin + Send + 'static, H: Handler + Send + 'static,
```

---

## 模块

### error

📁 **mod**

---

### fs

📁 **mod**

---

### rawsession

📁 **mod**

---
