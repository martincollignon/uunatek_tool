mod gemini;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_serialplugin::init())
    .plugin(
      tauri_plugin_log::Builder::default()
        .level(log::LevelFilter::Info)
        .build(),
    )
    .setup(|_app| {
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      gemini::gemini_check_status,
      gemini::gemini_generate,
      gemini::gemini_edit,
      gemini::gemini_process_image,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
