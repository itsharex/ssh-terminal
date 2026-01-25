# 模块 client::fs

Filesystem manipulation operations.

This module contains methods for interacting with remote entities on high-level. The architecture is quite simple because it is built as an analogue of [`std::fs`](https://doc.rust-lang.org/nightly/std/fs/index.html "mod std::fs")

**本模块包含 4 个项目**

## 结构体

### DirEntry

📦 **struct**

#### 定义

```rust
pub struct DirEntry { /* private fields */ }
```

#### 方法

```rust
pub fn file_name (&self) ->String
```

```rust
pub fn file_type (&self) ->FileType
```

```rust
pub fn metadata (&self) ->Metadata
```

#### 实现的 Trait

`Debug`

---

### File

📦 **struct**

#### 定义

```rust
pub struct File { /* private fields */ }
```

#### 方法

```rust
pub async fn metadata (&self) ->SftpResult<Metadata>
```

```rust
pub async fn set_metadata (&self, metadata: Metadata ) ->SftpResult<()>
```

```rust
pub async fn sync_all (&self) ->SftpResult<()>
```

#### 实现的 Trait

`AsyncRead`, `AsyncSeek`, `AsyncWrite`, `Drop`

---

### ReadDir

📦 **struct**

#### 定义

```rust
pub struct ReadDir { /* private fields */ }
```

#### 实现的 Trait

`Iterator`

---

## 类型别名

### Metadata

🔖 **type**

#### 定义

```rust
pub type Metadata = FileAttributes ;
```

---
