# 模块 ser

**本模块包含 3 个项目**

## 结构体

### Serializer

📦 **struct**

#### 定义

```rust
pub struct Serializer { /* private fields */ }
```

#### 实现的 Trait

`SerializeMap`, `SerializeSeq`, `SerializeStruct`, `SerializeStructVariant`, `SerializeTuple`, `SerializeTupleStruct`, `SerializeTupleVariant`

---

## 函数

### data_serialize

🔧 **fn**

#### 定义

```rust
pub fn data_serialize<S>( data: & Vec<u8>, serializer: S, ) ->Result<S: : Ok , S: : Error>where S: Serializer ,
```

---

### to_bytes

🔧 **fn**

#### 定义

```rust
pub fn to_bytes<T>(value: &T ) ->Result<Bytes , Error>where T: Serialize + ? Sized ,
```

---
