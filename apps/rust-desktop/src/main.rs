use std::fs;
use std::path::PathBuf;

use eframe::egui;
use rfd::FileDialog;
use rust_api::{preview_markdown_value, render_docx_bytes, BibliographyConfig, GenerateConfig};

const DEFAULT_MARKDOWN: &str = "# AI Report Formatter (Rust Frontend)\n\nWrite your markdown here.\n\n[@doe2024]\n\n$$E=mc^2$$\n";

struct RustDesktopApp {
    markdown: String,
    preview_json: String,
    status: String,
    last_saved_path: Option<PathBuf>,
    config: GenerateConfig,
    bibliography: BibliographyConfig,
}

impl Default for RustDesktopApp {
    fn default() -> Self {
        Self {
            markdown: String::from(DEFAULT_MARKDOWN),
            preview_json: String::from("Click 'Preview' to render current markdown."),
            status: String::from("Ready"),
            last_saved_path: None,
            config: GenerateConfig::default(),
            bibliography: BibliographyConfig::default(),
        }
    }
}

impl RustDesktopApp {
    fn import_markdown(&mut self) {
        let Some(path) = FileDialog::new()
            .add_filter("Markdown", &["md", "markdown", "txt"])
            .pick_file()
        else {
            return;
        };

        match fs::read_to_string(&path) {
            Ok(content) => {
                self.markdown = content;
                self.status = format!("Imported: {}", path.display());
            }
            Err(err) => {
                self.status = format!("Import failed: {}", err);
            }
        }
    }

    fn run_preview(&mut self) {
        match preview_markdown_value(&self.markdown, &self.bibliography) {
            Ok(value) => match serde_json::to_string_pretty(&value) {
                Ok(json) => {
                    self.preview_json = json;
                    self.status = String::from("Preview updated");
                }
                Err(err) => {
                    self.status = format!("Preview serialization failed: {}", err);
                }
            },
            Err(err) => {
                self.status = format!("Preview failed: {}", err);
            }
        }
    }

    fn export_docx(&mut self) {
        let Some(path) = FileDialog::new()
            .set_file_name("ai-report.docx")
            .add_filter("Word Document", &["docx"])
            .save_file()
        else {
            return;
        };

        match render_docx_bytes(&self.markdown, &self.config, &self.bibliography) {
            Ok(docx_bytes) => match fs::write(&path, docx_bytes) {
                Ok(()) => {
                    self.status = format!("Exported: {}", path.display());
                    self.last_saved_path = Some(path);
                }
                Err(err) => {
                    self.status = format!("Write failed: {}", err);
                }
            },
            Err(err) => {
                self.status = format!("Export failed: {}", err);
            }
        }
    }
}

impl eframe::App for RustDesktopApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        egui::TopBottomPanel::top("toolbar").show(ctx, |ui| {
            ui.horizontal_wrapped(|ui| {
                if ui.button("Import Markdown").clicked() {
                    self.import_markdown();
                }
                if ui.button("Preview").clicked() {
                    self.run_preview();
                }
                if ui.button("Export DOCX").clicked() {
                    self.export_docx();
                }

                ui.separator();
                ui.label(format!("Status: {}", self.status));
                if let Some(path) = &self.last_saved_path {
                    ui.label(format!("Last file: {}", path.display()));
                }
            });
        });

        egui::CentralPanel::default().show(ctx, |ui| {
            ui.columns(2, |columns| {
                columns[0].heading("Markdown");
                columns[0].add(
                    egui::TextEdit::multiline(&mut self.markdown)
                        .desired_rows(42)
                        .desired_width(f32::INFINITY),
                );

                columns[1].heading("Preview JSON");
                egui::ScrollArea::vertical().show(&mut columns[1], |ui| {
                    ui.add(
                        egui::TextEdit::multiline(&mut self.preview_json)
                            .desired_rows(42)
                            .desired_width(f32::INFINITY),
                    );
                });
            });
        });
    }
}

fn main() -> eframe::Result<()> {
    let options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default().with_inner_size([1400.0, 860.0]),
        ..Default::default()
    };

    eframe::run_native(
        "AI Report Formatter - Rust Desktop",
        options,
        Box::new(|_cc| Ok(Box::new(RustDesktopApp::default()))),
    )
}
