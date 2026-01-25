# 模块 protocol

Protocol implementation

**本模块包含 38 个项目**

## 结构体

### Attrs

📦 **struct**

#### 定义

```rust
pub struct Attrs {
    pub id: u32,
    pub attrs: FileAttributes
}
```

#### 实现的 Trait

`Debug`, `Serialize`

---

### Close

📦 **struct**

#### 定义

```rust
pub struct Close {
    pub id: u32,
    pub handle: String
}
```

#### 实现的 Trait

`Debug`, `Serialize`

---

### Data

📦 **struct**

#### 定义

```rust
pub struct Data {
    pub id: u32,
    pub data: Vec<u8>
}
```

#### 实现的 Trait

`Debug`, `Serialize`

---

### Extended

📦 **struct**

#### 定义

```rust
pub struct Extended {
    pub id: u32,
    pub request: String,
    pub data: Vec<u8>
}
```

#### 实现的 Trait

`Debug`, `Serialize`

---

### ExtendedReply

📦 **struct**

#### 定义

```rust
pub struct ExtendedReply {
    pub id: u32,
    pub data: Vec<u8>
}
```

#### 实现的 Trait

`Debug`, `Serialize`

---

### FSetStat

📦 **struct**

#### 定义

```rust
pub struct FSetStat {
    pub id: u32,
    pub handle: String,
    pub attrs: FileAttributes
}
```

#### 实现的 Trait

`Debug`, `Serialize`

---

### File

📦 **struct**

#### 定义

```rust
pub struct File {
    pub filename: String,
    pub longname: String,
    pub attrs: FileAttributes
}
```

#### 方法

```rust
pub fn dummy<S: Into<String>>(filename: S) ->Self
```

```rust
pub fn new<S: Into<String>>(filename: S, attrs: FileAttributes ) ->Self
```

```rust
pub fn longname (&self) ->String
```

#### 实现的 Trait

`Clone`, `Debug`, `Serialize`

---

### FileAttr

📦 **struct**

#### 定义

```rust
pub struct FileAttr( /* private fields */ );
```

#### 方法

```rust
pub const fn empty () ->Self
```

```rust
pub const fn all () ->Self
```

```rust
pub const fn bits (&self) ->u32
```

```rust
pub const fn from_bits (bits: u32 ) ->Option<Self>
```

```rust
pub const fn from_bits_truncate (bits: u32 ) ->Self
```

```rust
pub const fn from_bits_retain (bits: u32 ) ->Self
```

```rust
pub fn from_name (name: & str ) ->Option<Self>
```

```rust
pub const fn is_empty (&self) ->bool
```

```rust
pub const fn is_all (&self) ->bool
```

```rust
pub const fn intersects (&self, other: Self) ->bool
```

```rust
pub const fn contains (&self, other: Self) ->bool
```

```rust
pub fn insert (&mut self, other: Self)
```

```rust
pub fn remove (&mut self, other: Self)
```

```rust
pub fn toggle (&mut self, other: Self)
```

```rust
pub fn set (&mut self, other: Self, value: bool )
```

```rust
pub const fn intersection (self, other: Self) ->Self
```

```rust
pub const fn union (self, other: Self) ->Self
```

```rust
pub const fn difference (self, other: Self) ->Self
```

```rust
pub const fn symmetric_difference (self, other: Self) ->Self
```

```rust
pub const fn complement (self) ->Self
```

```rust
pub const fn iter (&self) ->Iter<FileAttr>
```

```rust
pub const fn iter_names (&self) ->IterNames<FileAttr>
```

#### 实现的 Trait

`Binary`, `BitAnd`, `BitAndAssign`, `BitOr`, `BitOrAssign`, `BitXor`, `BitXorAssign`, `Clone`, `Default`, `Flags`, `IntoIterator`, `LowerHex`, `Not`, `Octal`, `PartialEq`, `Serialize`, `Sub`, `SubAssign`, `UpperHex`, `Copy`, `Eq`, `StructuralPartialEq`

---

### FileAttributes

📦 **struct**

#### 定义

```rust
pub struct FileAttributes {
    pub size: Option<u64>,
    pub uid: Option<u32>,
    pub user: Option<String>,
    pub gid: Option<u32>,
    pub group: Option<String>,
    pub permissions: Option<u32>,
    pub atime: Option<u32>,
    pub mtime: Option<u32>
}
```

#### 方法

```rust
pub fn is_dir (&self) ->bool
```

```rust
pub fn set_dir (&mut self, is_dir: bool )
```

```rust
pub fn is_regular (&self) ->bool
```

```rust
pub fn set_regular (&mut self, is_regular: bool )
```

```rust
pub fn is_symlink (&self) ->bool
```

```rust
pub fn set_symlink (&mut self, is_symlink: bool )
```

```rust
pub fn is_character (&self) ->bool
```

```rust
pub fn set_character (&mut self, is_character: bool )
```

```rust
pub fn is_block (&self) ->bool
```

```rust
pub fn set_block (&mut self, is_block: bool )
```

```rust
pub fn is_fifo (&self) ->bool
```

```rust
pub fn set_fifo (&mut self, is_fifo: bool )
```

```rust
pub fn set_type (&mut self, mode: FileMode )
```

```rust
pub fn remove_type (&mut self, mode: FileMode )
```

```rust
pub fn file_type (&self) ->FileType
```

```rust
pub fn is_empty (&self) ->bool
```

```rust
pub fn len (&self) ->u64
```

```rust
pub fn permissions (&self) ->FilePermissions
```

```rust
pub fn accessed (&self) ->Result<SystemTime>
```

```rust
pub fn modified (&self) ->Result<SystemTime>
```

```rust
pub fn empty () ->Self
```

#### 实现的 Trait

`Clone`, `Debug`, `Default`, `Serialize`

---

### FileMode

📦 **struct**

#### 定义

```rust
pub struct FileMode( /* private fields */ );
```

#### 方法

```rust
pub const fn empty () ->Self
```

```rust
pub const fn all () ->Self
```

```rust
pub const fn bits (&self) ->u32
```

```rust
pub const fn from_bits (bits: u32 ) ->Option<Self>
```

```rust
pub const fn from_bits_truncate (bits: u32 ) ->Self
```

```rust
pub const fn from_bits_retain (bits: u32 ) ->Self
```

```rust
pub fn from_name (name: & str ) ->Option<Self>
```

```rust
pub const fn is_empty (&self) ->bool
```

```rust
pub const fn is_all (&self) ->bool
```

```rust
pub const fn intersects (&self, other: Self) ->bool
```

```rust
pub const fn contains (&self, other: Self) ->bool
```

```rust
pub fn insert (&mut self, other: Self)
```

```rust
pub fn remove (&mut self, other: Self)
```

```rust
pub fn toggle (&mut self, other: Self)
```

```rust
pub fn set (&mut self, other: Self, value: bool )
```

```rust
pub const fn intersection (self, other: Self) ->Self
```

```rust
pub const fn union (self, other: Self) ->Self
```

```rust
pub const fn difference (self, other: Self) ->Self
```

```rust
pub const fn symmetric_difference (self, other: Self) ->Self
```

```rust
pub const fn complement (self) ->Self
```

```rust
pub const fn iter (&self) ->Iter<FileMode>
```

```rust
pub const fn iter_names (&self) ->IterNames<FileMode>
```

#### 实现的 Trait

`Binary`, `BitAnd`, `BitAndAssign`, `BitOr`, `BitOrAssign`, `BitXor`, `BitXorAssign`, `Clone`, `Default`, `Flags`, `IntoIterator`, `LowerHex`, `Not`, `Octal`, `PartialEq`, `Serialize`, `Sub`, `SubAssign`, `UpperHex`, `Copy`, `Eq`, `StructuralPartialEq`

---

### FilePermissionFlags

📦 **struct**

#### 定义

```rust
pub struct FilePermissionFlags( /* private fields */ );
```

#### 方法

```rust
pub const fn empty () ->Self
```

```rust
pub const fn all () ->Self
```

```rust
pub const fn bits (&self) ->u32
```

```rust
pub const fn from_bits (bits: u32 ) ->Option<Self>
```

```rust
pub const fn from_bits_truncate (bits: u32 ) ->Self
```

```rust
pub const fn from_bits_retain (bits: u32 ) ->Self
```

```rust
pub fn from_name (name: & str ) ->Option<Self>
```

```rust
pub const fn is_empty (&self) ->bool
```

```rust
pub const fn is_all (&self) ->bool
```

```rust
pub const fn intersects (&self, other: Self) ->bool
```

```rust
pub const fn contains (&self, other: Self) ->bool
```

```rust
pub fn insert (&mut self, other: Self)
```

```rust
pub fn remove (&mut self, other: Self)
```

```rust
pub fn toggle (&mut self, other: Self)
```

```rust
pub fn set (&mut self, other: Self, value: bool )
```

```rust
pub const fn intersection (self, other: Self) ->Self
```

```rust
pub const fn union (self, other: Self) ->Self
```

```rust
pub const fn difference (self, other: Self) ->Self
```

```rust
pub const fn symmetric_difference (self, other: Self) ->Self
```

```rust
pub const fn complement (self) ->Self
```

```rust
pub const fn iter (&self) ->Iter<FilePermissionFlags>
```

```rust
pub const fn iter_names (&self) ->IterNames<FilePermissionFlags>
```

#### 实现的 Trait

`Binary`, `BitAnd`, `BitAndAssign`, `BitOr`, `BitOrAssign`, `BitXor`, `BitXorAssign`, `Clone`, `Default`, `Flags`, `IntoIterator`, `LowerHex`, `Not`, `Octal`, `PartialEq`, `Serialize`, `Sub`, `SubAssign`, `UpperHex`, `Copy`, `Eq`, `StructuralPartialEq`

---

### FilePermissions

📦 **struct**

#### 定义

```rust
pub struct FilePermissions {
    pub other_exec: bool,
    pub other_read: bool,
    pub other_write: bool,
    pub group_exec: bool,
    pub group_read: bool,
    pub group_write: bool,
    pub owner_exec: bool,
    pub owner_read: bool,
    pub owner_write: bool
}
```

#### 方法

```rust
pub fn is_readonly (&self) ->bool
```

```rust
pub fn set_readonly (&mut self, readonly: bool )
```

#### 实现的 Trait

`Clone`, `Default`, `Display`, `PartialEq`, `Copy`, `Eq`, `StructuralPartialEq`

---

### Fstat

📦 **struct**

#### 定义

```rust
pub struct Fstat {
    pub id: u32,
    pub handle: String
}
```

#### 实现的 Trait

`Debug`, `Serialize`

---

### Handle

📦 **struct**

#### 定义

```rust
pub struct Handle {
    pub id: u32,
    pub handle: String
}
```

#### 实现的 Trait

`Debug`, `Serialize`

---

### Init

📦 **struct**

#### 定义

```rust
pub struct Init {
    pub version: u32,
    pub extensions: HashMap<String , String>
}
```

#### 方法

```rust
pub fn new () ->Self
```

#### 实现的 Trait

`Debug`, `Default`, `Serialize`

---

### Lstat

📦 **struct**

#### 定义

```rust
pub struct Lstat {
    pub id: u32,
    pub path: String
}
```

#### 实现的 Trait

`Debug`, `Serialize`

---

### MkDir

📦 **struct**

#### 定义

```rust
pub struct MkDir {
    pub id: u32,
    pub path: String,
    pub attrs: FileAttributes
}
```

#### 实现的 Trait

`Debug`, `Serialize`

---

### Name

📦 **struct**

#### 定义

```rust
pub struct Name {
    pub id: u32,
    pub files: Vec<File>
}
```

#### 实现的 Trait

`Debug`, `Serialize`

---

### Open

📦 **struct**

#### 定义

```rust
pub struct Open {
    pub id: u32,
    pub filename: String,
    pub pflags: OpenFlags,
    pub attrs: FileAttributes
}
```

#### 实现的 Trait

`Debug`, `Serialize`

---

### OpenDir

📦 **struct**

#### 定义

```rust
pub struct OpenDir {
    pub id: u32,
    pub path: String
}
```

#### 实现的 Trait

`Debug`, `Serialize`

---

### OpenFlags

📦 **struct**

#### 定义

```rust
pub struct OpenFlags( /* private fields */ );
```

#### 方法

```rust
pub const fn empty () ->Self
```

```rust
pub const fn all () ->Self
```

```rust
pub const fn bits (&self) ->u32
```

```rust
pub const fn from_bits (bits: u32 ) ->Option<Self>
```

```rust
pub const fn from_bits_truncate (bits: u32 ) ->Self
```

```rust
pub const fn from_bits_retain (bits: u32 ) ->Self
```

```rust
pub fn from_name (name: & str ) ->Option<Self>
```

```rust
pub const fn is_empty (&self) ->bool
```

```rust
pub const fn is_all (&self) ->bool
```

```rust
pub const fn intersects (&self, other: Self) ->bool
```

```rust
pub const fn contains (&self, other: Self) ->bool
```

```rust
pub fn insert (&mut self, other: Self)
```

```rust
pub fn remove (&mut self, other: Self)
```

```rust
pub fn toggle (&mut self, other: Self)
```

```rust
pub fn set (&mut self, other: Self, value: bool )
```

```rust
pub const fn intersection (self, other: Self) ->Self
```

```rust
pub const fn union (self, other: Self) ->Self
```

```rust
pub const fn difference (self, other: Self) ->Self
```

```rust
pub const fn symmetric_difference (self, other: Self) ->Self
```

```rust
pub const fn complement (self) ->Self
```

```rust
pub const fn iter (&self) ->Iter<OpenFlags>
```

```rust
pub const fn iter_names (&self) ->IterNames<OpenFlags>
```

#### 实现的 Trait

`Binary`, `BitAnd`, `BitAndAssign`, `BitOr`, `BitOrAssign`, `BitXor`, `BitXorAssign`, `Clone`, `Debug`, `Default`, `Flags`, `IntoIterator`, `LowerHex`, `Not`, `Octal`, `Serialize`, `Sub`, `SubAssign`, `UpperHex`, `Copy`

---

### Read

📦 **struct**

#### 定义

```rust
pub struct Read {
    pub id: u32,
    pub handle: String,
    pub offset: u64,
    pub len: u32
}
```

#### 实现的 Trait

`Debug`, `Serialize`

---

### ReadDir

📦 **struct**

#### 定义

```rust
pub struct ReadDir {
    pub id: u32,
    pub handle: String
}
```

#### 实现的 Trait

`Debug`, `Serialize`

---

### ReadLink

📦 **struct**

#### 定义

```rust
pub struct ReadLink {
    pub id: u32,
    pub path: String
}
```

#### 实现的 Trait

`Debug`, `Serialize`

---

### RealPath

📦 **struct**

#### 定义

```rust
pub struct RealPath {
    pub id: u32,
    pub path: String
}
```

#### 实现的 Trait

`Debug`, `Serialize`

---

### Remove

📦 **struct**

#### 定义

```rust
pub struct Remove {
    pub id: u32,
    pub filename: String
}
```

#### 实现的 Trait

`Debug`, `Serialize`

---

### Rename

📦 **struct**

#### 定义

```rust
pub struct Rename {
    pub id: u32,
    pub oldpath: String,
    pub newpath: String
}
```

#### 实现的 Trait

`Debug`, `Serialize`

---

### RmDir

📦 **struct**

#### 定义

```rust
pub struct RmDir {
    pub id: u32,
    pub path: String
}
```

#### 实现的 Trait

`Debug`, `Serialize`

---

### SetStat

📦 **struct**

#### 定义

```rust
pub struct SetStat {
    pub id: u32,
    pub path: String,
    pub attrs: FileAttributes
}
```

#### 实现的 Trait

`Debug`, `Serialize`

---

### Stat

📦 **struct**

#### 定义

```rust
pub struct Stat {
    pub id: u32,
    pub path: String
}
```

#### 实现的 Trait

`Debug`, `Serialize`

---

### Status

📦 **struct**

#### 定义

```rust
pub struct Status {
    pub id: u32,
    pub status_code: StatusCode,
    pub error_message: String,
    pub language_tag: String
}
```

#### 实现的 Trait

`Clone`, `Debug`, `Serialize`

---

### Symlink

📦 **struct**

#### 定义

```rust
pub struct Symlink {
    pub id: u32,
    pub linkpath: String,
    pub targetpath: String
}
```

#### 实现的 Trait

`Debug`, `Serialize`

---

### Version

📦 **struct**

#### 定义

```rust
pub struct Version {
    pub version: u32,
    pub extensions: HashMap<String , String>
}
```

#### 方法

```rust
pub fn new () ->Self
```

#### 实现的 Trait

`Debug`, `Default`, `Serialize`

---

### Write

📦 **struct**

#### 定义

```rust
pub struct Write {
    pub id: u32,
    pub handle: String,
    pub offset: u64,
    pub data: Vec<u8>
}
```

#### 实现的 Trait

`Debug`, `Serialize`

---

## 枚举

### FileType

🔷 **enum**

#### 定义

```rust
pub enum FileType {
    Dir,
    File,
    Symlink,
    Other
}
```

#### 变体

- **Dir**
- **File**
- **Symlink**
- **Other**

#### 方法

```rust
pub fn is_dir (&self) ->bool
```

```rust
pub fn is_file (&self) ->bool
```

```rust
pub fn is_symlink (&self) ->bool
```

```rust
pub fn is_other (&self) ->bool
```

#### 实现的 Trait

`Clone`, `Debug`, `PartialEq`, `Copy`, `Eq`, `StructuralPartialEq`

---

### Packet

🔷 **enum**

#### 定义

```rust
pub enum Packet {
    Show 27 variants Init( Init ),
    Version( Version ),
    Open( Open ),
    Close( Close ),
    Read( Read ),
    Write( Write ),
    Lstat( Lstat ),
    Fstat( Fstat ),
    SetStat( SetStat ),
    FSetStat( FSetStat ),
    OpenDir( OpenDir ),
    ReadDir( ReadDir ),
    Remove( Remove ),
    MkDir( MkDir ),
    RmDir( RmDir ),
    RealPath( RealPath ),
    Stat( Stat ),
    Rename( Rename ),
    ReadLink( ReadLink ),
    Symlink( Symlink ),
    Status( Status ),
    Handle( Handle ),
    Data( Data ),
    Name( Name ),
    Attrs( Attrs ),
    Extended( Extended ),
    ExtendedReply( ExtendedReply )
}
```

#### 变体

- **Init(Init)**
- **Version(Version)**
- **Open(Open)**
- **Close(Close)**
- **Read(Read)**
- **Write(Write)**
- **Lstat(Lstat)**
- **Fstat(Fstat)**
- **SetStat(SetStat)**
- **FSetStat(FSetStat)**
- **OpenDir(OpenDir)**
- **ReadDir(ReadDir)**
- **Remove(Remove)**
- **MkDir(MkDir)**
- **RmDir(RmDir)**
- **RealPath(RealPath)**
- **Stat(Stat)**
- **Rename(Rename)**
- **ReadLink(ReadLink)**
- **Symlink(Symlink)**
- **Status(Status)**
- **Handle(Handle)**
- **Data(Data)**
- **Name(Name)**
- **Attrs(Attrs)**
- **Extended(Extended)**
- **ExtendedReply(ExtendedReply)**

#### 方法

```rust
pub fn get_request_id (&self) ->u32
```

```rust
pub fn status (id: u32 , status_code: StatusCode , msg: & str , tag: & str ) ->Self
```

```rust
pub fn error (id: u32 , status_code: StatusCode ) ->Self
```

#### 实现的 Trait

`Debug`

---

### StatusCode

🔷 **enum**

#### 定义

```rust
pub enum StatusCode {
    Ok = 0,
    Eof = 1,
    NoSuchFile = 2,
    PermissionDenied = 3,
    Failure = 4,
    BadMessage = 5,
    NoConnection = 6,
    ConnectionLost = 7,
    OpUnsupported = 8
}
```

#### 变体

- **Ok = 0**
- **Eof = 1**
- **NoSuchFile = 2**
- **PermissionDenied = 3**
- **Failure = 4**
- **BadMessage = 5**
- **NoConnection = 6**
- **ConnectionLost = 7**
- **OpUnsupported = 8**

#### 实现的 Trait

`Clone`, `Debug`, `Display`, `Error`, `PartialEq`, `Serialize`, `Copy`, `StructuralPartialEq`

---

## 常量

### VERSION

📍 **constant**

#### 定义

```rust
pub const VERSION: u32 = 3;
```

---
