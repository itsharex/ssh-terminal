fn main() {
    // ============================================================
    // Android 平台特定配置
    // ============================================================

    // 检查是否为 Android 目标
    let target_os = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    let is_android = target_os == "android";

    if is_android {
        // 禁用 getentropy（Android NDK 不支持此系统调用）
        // 这将告诉 aws-lc-sys 使用替代的熵源
        println!("cargo:warning=Disabling getentropy for Android target (NDK compatibility)");
        std::env::set_var("AWS_LC_SYS_NO_GETENTROPY", "1");
        println!("cargo:rustc-env=AWS_LC_SYS_NO_GETENTROPY=1");

        // 禁用 jitter entropy（可选，进一步提升 NDK 兼容性）
        println!("cargo:warning=Disabling jitter entropy for Android target");
        std::env::set_var("AWS_LC_SYS_NO_JITTER_ENTROPY", "1");
        println!("cargo:rustc-env=AWS_LC_SYS_NO_JITTER_ENTROPY=1");
    }

    // ============================================================
    // Tauri 默认构建
    // ============================================================
    tauri_build::build();

    // ============================================================
    // Android 额外配置提示
    // ============================================================
    if is_android {
        println!("cargo:warning=Android build configured with:");
        println!("cargo:warning=  - AWS_LC_SYS_NO_GETENTROPY=1");
        println!("cargo:warning=  - AWS_LC_SYS_NO_JITTER_ENTROPY=1");
        println!("cargo:warning=Using alternative entropy sources for Android");
    }
}

