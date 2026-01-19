use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Serialize, Deserialize)]
pub struct GeminiStatusResponse {
    pub configured: bool,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GeminiGenerateResponse {
    pub image_base64: String,
    pub prompt_used: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GeminiGenerateRequest {
    pub prompt: String,
    pub style: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GeminiEditRequest {
    pub image_base64: String,
    pub prompt: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GeminiProcessRequest {
    pub image_base64: String,
    pub style: Option<String>,
    pub custom_prompt: Option<String>,
    pub remove_background: Option<bool>,
    pub threshold: Option<u32>,
    pub padding: Option<u32>,
}

/// Get API key - checks compile-time env first, then runtime env
fn get_api_key() -> Option<String> {
    // First check if key was bundled at compile time
    const BUNDLED_KEY: Option<&str> = option_env!("GEMINI_API_KEY");
    if let Some(key) = BUNDLED_KEY {
        if !key.is_empty() && key != "your_api_key_here" {
            return Some(key.to_string());
        }
    }

    // Fall back to runtime environment variable
    std::env::var("GEMINI_API_KEY")
        .ok()
        .filter(|k| !k.is_empty() && k != "your_api_key_here")
}

/// Check if Gemini API is configured
#[tauri::command]
pub async fn gemini_check_status() -> Result<GeminiStatusResponse, String> {
    match get_api_key() {
        Some(_) => Ok(GeminiStatusResponse {
            configured: true,
            message: "Gemini API is configured".to_string(),
        }),
        None => Ok(GeminiStatusResponse {
            configured: false,
            message: "Gemini API key not configured. Configure in the app settings.".to_string(),
        }),
    }
}

/// Generate image from text prompt
#[tauri::command]
pub async fn gemini_generate(request: GeminiGenerateRequest) -> Result<GeminiGenerateResponse, String> {
    // Call Python backend script
    call_python_backend("generate", &request)
        .await
        .map_err(|e| format!("Failed to generate image: {}", e))
}

/// Edit existing image with prompt
#[tauri::command]
pub async fn gemini_edit(request: GeminiEditRequest) -> Result<GeminiGenerateResponse, String> {
    call_python_backend("edit", &request)
        .await
        .map_err(|e| format!("Failed to edit image: {}", e))
}

/// Process image for plotter
#[tauri::command]
pub async fn gemini_process_image(request: GeminiProcessRequest) -> Result<GeminiGenerateResponse, String> {
    call_python_backend("process", &request)
        .await
        .map_err(|e| format!("Failed to process image: {}", e))
}

/// Helper function to call Python backend
async fn call_python_backend<T: Serialize, R: for<'de> Deserialize<'de>>(
    operation: &str,
    request: &T,
) -> Result<R, String> {
    // Serialize request to JSON
    let json_input = serde_json::to_string(request)
        .map_err(|e| format!("Failed to serialize request: {}", e))?;

    // Get the path to the Python backend
    let backend_path = std::env::current_dir()
        .map_err(|e| format!("Failed to get current directory: {}", e))?
        .parent()
        .ok_or("Failed to get parent directory")?
        .join("backend");

    // Call Python script
    let output = Command::new("python3")
        .current_dir(&backend_path)
        .arg("-m")
        .arg("core.gemini.cli")
        .arg(operation)
        .arg(&json_input)
        .output()
        .map_err(|e| format!("Failed to execute Python: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Python backend error: {}", stderr));
    }

    // Parse response
    let stdout = String::from_utf8_lossy(&output.stdout);
    serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse response: {}", e))
}
