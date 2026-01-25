# 模块 extensions

**本模块包含 9 个项目**

## 结构体

### FsyncExtension

📦 **struct**

#### 定义

```rust
pub struct FsyncExtension { pub handle: String , }
```

#### 实现的 Trait

`Debug`, `Serialize`

---

### HardlinkExtension

📦 **struct**

#### 定义

```rust
pub struct HardlinkExtension {
    pub oldpath: String,
    pub newpath: String
}
```

#### 实现的 Trait

`Debug`, `Serialize`

---

### LimitsExtension

📦 **struct**

#### 定义

```rust
pub struct LimitsExtension {
    pub max_packet_len: u64,
    pub max_read_len: u64,
    pub max_write_len: u64,
    pub max_open_handles: u64
}
```

#### 实现的 Trait

`Debug`, `Serialize`

---

### Statvfs

📦 **struct**

#### 定义

```rust
pub struct Statvfs {
    pub block_size: u64,
    pub fragment_size: u64,
    pub blocks: u64,
    pub blocks_free: u64,
    pub blocks_avail: u64,
    pub inodes: u64,
    pub inodes_free: u64,
    pub inodes_avail: u64,
    pub fs_id: u64,
    pub flags: u64,
    pub name_max: u64
}
```

#### 实现的 Trait

`Debug`, `Serialize`

---

### StatvfsExtension

📦 **struct**

#### 定义

```rust
pub struct StatvfsExtension { pub path: String , }
```

#### 实现的 Trait

`Debug`, `Serialize`

---

## 常量

### FSYNC

📍 **constant**

#### 定义

```rust
pub const FSYNC: & str = "fsync@openssh.com";
```

---

### HARDLINK

📍 **constant**

#### 定义

```rust
pub const HARDLINK: & str = "hardlink@openssh.com";
```

---

### LIMITS

📍 **constant**

#### 定义

```rust
pub const LIMITS: & str = "limits@openssh.com";
```

---

### STATVFS

📍 **constant**

#### 定义

```rust
pub const STATVFS: & str = "statvfs@openssh.com";
```

---
