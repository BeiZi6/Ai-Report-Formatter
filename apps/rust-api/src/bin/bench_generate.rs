use std::fs;
use std::process;

use rust_api::{benchmark_generate_pipeline, BibliographyConfig, GenerateConfig};

const DEFAULT_ITERATIONS: usize = 50;
const DEFAULT_MARKDOWN: &str = "# Benchmark Sample\n\nThis is a paragraph with citation [@doe2024].\n\n$$E=mc^2$$\n\n| h1 | h2 |\n| --- | --- |\n| a | b |\n";

fn parse_args() -> Result<(usize, Option<String>), String> {
    let mut iterations = DEFAULT_ITERATIONS;
    let mut input_path: Option<String> = None;

    let mut args = std::env::args().skip(1);
    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--iterations" | "-n" => {
                let Some(value) = args.next() else {
                    return Err(String::from("missing value for --iterations"));
                };
                iterations = value
                    .parse::<usize>()
                    .map_err(|_| format!("invalid iterations value: {}", value))?;
            }
            "--input" | "-i" => {
                let Some(value) = args.next() else {
                    return Err(String::from("missing value for --input"));
                };
                input_path = Some(value);
            }
            "--help" | "-h" => {
                return Err(String::from("help"));
            }
            other => {
                return Err(format!("unknown argument: {}", other));
            }
        }
    }

    Ok((iterations, input_path))
}

fn load_markdown(input_path: Option<&str>) -> Result<String, String> {
    match input_path {
        Some(path) => {
            fs::read_to_string(path).map_err(|err| format!("failed to read {}: {}", path, err))
        }
        None => Ok(String::from(DEFAULT_MARKDOWN)),
    }
}

fn print_usage() {
    println!("Usage: cargo run --manifest-path apps/rust-api/Cargo.toml --bin bench_generate -- [--iterations N] [--input markdown_file]");
}

fn main() {
    let (iterations, input_path) = match parse_args() {
        Ok(parsed) => parsed,
        Err(err) if err == "help" => {
            print_usage();
            return;
        }
        Err(err) => {
            eprintln!("argument error: {}", err);
            print_usage();
            process::exit(2);
        }
    };

    let markdown = match load_markdown(input_path.as_deref()) {
        Ok(content) => content,
        Err(err) => {
            eprintln!("input error: {}", err);
            process::exit(1);
        }
    };

    let report = match benchmark_generate_pipeline(
        &markdown,
        &GenerateConfig::default(),
        &BibliographyConfig::default(),
        iterations,
    ) {
        Ok(report) => report,
        Err(err) => {
            eprintln!("benchmark failed: {}", err);
            process::exit(1);
        }
    };

    match serde_json::to_string_pretty(&report) {
        Ok(json) => println!("{}", json),
        Err(err) => {
            eprintln!("serialization failed: {}", err);
            process::exit(1);
        }
    }
}
