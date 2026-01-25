# 模块 de

**本模块包含 3 个项目**

## 结构体

### Deserializer

📦 **struct**

#### 定义

```rust
pub struct Deserializer<'a>{ /* private fields */ }
```

---

## 函数

### data_deserialize

🔧 **fn**

#### 定义

```rust
pub fn data_deserialize<'de, D>(deserializer: D) ->Result<Vec<u8>, D: : Error>where D: Deserializer<'de>,
```

---

### from_bytes

🔧 **fn**

#### 定义

```rust
pub fn from_bytes<'a, T>(bytes: &'a mut Bytes ) ->Result<T, Error>where T: Deserialize<'a>,
```

---
