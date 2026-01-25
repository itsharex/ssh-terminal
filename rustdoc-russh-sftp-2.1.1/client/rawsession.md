# 模块 client::rawsession

**本模块包含 3 个项目**

## 结构体

### Limits

📦 **struct**

#### 定义

```rust
pub struct Limits {
    pub read_len: Option<u64>,
    pub write_len: Option<u64>,
    pub open_handles: Option<u64>
}
```

#### 实现的 Trait

`Clone`, `Debug`, `Default`, `Copy`

---

### RawSftpSession

📦 **struct**

#### 定义

```rust
pub struct RawSftpSession { /* private fields */ }
```

#### 方法

```rust
pub fn new<S>(stream: S) ->Self where S: AsyncRead + AsyncWrite + Unpin + Send + 'static,
```

```rust
pub async fn set_timeout (&self, secs: u64 )
```

```rust
pub fn set_limits (&mut self, limits: Arc<Limits>)
```

```rust
pub fn close_session (&self) ->SftpResult<()>
```

```rust
pub async fn init (&self) ->SftpResult<Version>
```

```rust
pub async fn open<T: Into<String>>( &self, filename: T, flags: OpenFlags , attrs: FileAttributes , ) ->SftpResult<Handle>
```

```rust
pub async fn close<H: Into<String>>(&self, handle: H) ->SftpResult<Status>
```

```rust
pub async fn read<H: Into<String>>( &self, handle: H, offset: u64 , len: u32 , ) ->SftpResult<Data>
```

```rust
pub async fn write<H: Into<String>>( &self, handle: H, offset: u64 , data: Vec<u8>, ) ->SftpResult<Status>
```

```rust
pub async fn lstat<P: Into<String>>(&self, path: P) ->SftpResult<Attrs>
```

```rust
pub async fn fstat<H: Into<String>>(&self, handle: H) ->SftpResult<Attrs>
```

```rust
pub async fn setstat<P: Into<String>>( &self, path: P, attrs: FileAttributes , ) ->SftpResult<Status>
```

```rust
pub async fn fsetstat<H: Into<String>>( &self, handle: H, attrs: FileAttributes , ) ->SftpResult<Status>
```

```rust
pub async fn opendir<P: Into<String>>(&self, path: P) ->SftpResult<Handle>
```

```rust
pub async fn readdir<H: Into<String>>(&self, handle: H) ->SftpResult<Name>
```

```rust
pub async fn remove<T: Into<String>>(&self, filename: T) ->SftpResult<Status>
```

```rust
pub async fn mkdir<P: Into<String>>( &self, path: P, attrs: FileAttributes , ) ->SftpResult<Status>
```

```rust
pub async fn rmdir<P: Into<String>>(&self, path: P) ->SftpResult<Status>
```

```rust
pub async fn realpath<P: Into<String>>(&self, path: P) ->SftpResult<Name>
```

```rust
pub async fn stat<P: Into<String>>(&self, path: P) ->SftpResult<Attrs>
```

```rust
pub async fn rename<O, N>(&self, oldpath: O, newpath: N) ->SftpResult<Status>where O: Into<String>, N: Into<String>,
```

```rust
pub async fn readlink<P: Into<String>>(&self, path: P) ->SftpResult<Name>
```

```rust
pub async fn symlink<P, T>(&self, path: P, target: T) ->SftpResult<Status>where P: Into<String>, T: Into<String>,
```

```rust
pub async fn extended<R: Into<String>>( &self, request: R, data: Vec<u8>, ) ->SftpResult<Packet>
```

```rust
pub async fn limits (&self) ->SftpResult<LimitsExtension>
```

```rust
pub async fn hardlink<O, N>(&self, oldpath: O, newpath: N) ->SftpResult<Status>where O: Into<String>, N: Into<String>,
```

```rust
pub async fn fsync<H: Into<String>>(&self, handle: H) ->SftpResult<Status>
```

```rust
pub async fn statvfs<P>(&self, path: P) ->SftpResult<Statvfs>where P: Into<String>,
```

#### 实现的 Trait

`Drop`

---

## 类型别名

### SftpResult

🔖 **type**

#### 定义

```rust
pub type SftpResult<T>= Result<T, Error>;
```

#### 变体

- **Ok(T)**
- **Err(Error)**

---
