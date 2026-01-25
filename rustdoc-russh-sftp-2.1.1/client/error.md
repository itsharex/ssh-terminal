# 模块 client::error

**本模块包含 1 个项目**

## 枚举

### Error

🔷 **enum**

#### 定义

```rust
pub enum Error {
    Status( Status ),
    IO( String ),
    Timeout,
    Limited( String ),
    UnexpectedPacket,
    UnexpectedBehavior( String )
}
```

#### 变体

- **Status(Status)**
- **IO(String)**
- **Timeout**
- **Limited(String)**
- **UnexpectedPacket**
- **UnexpectedBehavior(String)**

#### 实现的 Trait

`Clone`, `Debug`, `Display`, `Error`

---
