# 模块 server

Server side

**本模块包含 2 个项目**

## Trait

### Handler

✨ **trait**

#### 定义

```rust
pub trait Handler: Sized { type Error : Into<StatusCode>+ Send ; Show 21 methods // Required method fn unimplemented (&self) ->Self: : Error ; // Provided methods fn init ( &mut self, version: u32 , extensions: HashMap<String , String>, ) ->impl Future<Output = Result<Version , Self: : Error>>+ Send { ... } fn open ( &mut self, id: u32 , filename: String , pflags: OpenFlags , attrs: FileAttributes , ) ->impl Future<Output = Result<Handle , Self: : Error>>+ Send { ... } fn close ( &mut self, id: u32 , handle: String , ) ->impl Future<Output = Result<Status , Self: : Error>>+ Send { ... } fn read ( &mut self, id: u32 , handle: String , offset: u64 , len: u32 , ) ->impl Future<Output = Result<Data , Self: : Error>>+ Send { ... } fn write ( &mut self, id: u32 , handle: String , offset: u64 , data: Vec<u8>, ) ->impl Future<Output = Result<Status , Self: : Error>>+ Send { ... } fn lstat ( &mut self, id: u32 , path: String , ) ->impl Future<Output = Result<Attrs , Self: : Error>>+ Send { ... } fn fstat ( &mut self, id: u32 , handle: String , ) ->impl Future<Output = Result<Attrs , Self: : Error>>+ Send { ... } fn setstat ( &mut self, id: u32 , path: String , attrs: FileAttributes , ) ->impl Future<Output = Result<Status , Self: : Error>>+ Send { ... } fn fsetstat ( &mut self, id: u32 , handle: String , attrs: FileAttributes , ) ->impl Future<Output = Result<Status , Self: : Error>>+ Send { ... } fn opendir ( &mut self, id: u32 , path: String , ) ->impl Future<Output = Result<Handle , Self: : Error>>+ Send { ... } fn readdir ( &mut self, id: u32 , handle: String , ) ->impl Future<Output = Result<Name , Self: : Error>>+ Send { ... } fn remove ( &mut self, id: u32 , filename: String , ) ->impl Future<Output = Result<Status , Self: : Error>>+ Send { ... } fn mkdir ( &mut self, id: u32 , path: String , attrs: FileAttributes , ) ->impl Future<Output = Result<Status , Self: : Error>>+ Send { ... } fn rmdir ( &mut self, id: u32 , path: String , ) ->impl Future<Output = Result<Status , Self: : Error>>+ Send { ... } fn realpath ( &mut self, id: u32 , path: String , ) ->impl Future<Output = Result<Name , Self: : Error>>+ Send { ... } fn stat ( &mut self, id: u32 , path: String , ) ->impl Future<Output = Result<Attrs , Self: : Error>>+ Send { ... } fn rename ( &mut self, id: u32 , oldpath: String , newpath: String , ) ->impl Future<Output = Result<Status , Self: : Error>>+ Send { ... } fn readlink ( &mut self, id: u32 , path: String , ) ->impl Future<Output = Result<Name , Self: : Error>>+ Send { ... } fn symlink ( &mut self, id: u32 , linkpath: String , targetpath: String , ) ->impl Future<Output = Result<Status , Self: : Error>>+ Send { ... } fn extended ( &mut self, id: u32 , request: String , data: Vec<u8>, ) ->impl Future<Output = Result<Packet , Self: : Error>>+ Send { ... } }
```

---

## 函数

### run

🔧 **fn**

#### 定义

```rust
pub async fn run<S, H>(stream: S, handler: H) where S: AsyncRead + AsyncWrite + Unpin + Send + 'static, H: Handler + Send + 'static,
```

---
