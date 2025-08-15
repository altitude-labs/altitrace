use std::{fmt, path::PathBuf, str::FromStr};

use clap::{Args, ValueEnum};
use rolling_file::{RollingConditionBasic, RollingFileAppender as RollingFileAppenderLib};
use tracing::{level_filters::LevelFilter, Subscriber};
use tracing_appender::non_blocking::{NonBlocking, WorkerGuard};
use tracing_subscriber::{
    filter::Directive,
    fmt::format::{DefaultFields, Format},
    layer::Layer,
    prelude::__tracing_subscriber_SubscriberExt,
    registry::LookupSpan,
    util::SubscriberInitExt,
    EnvFilter,
};

#[derive(Debug, Args, Clone)]
#[command(next_help_heading = "Logs")]
pub(crate) struct LogsArgs {
    /// The format of the logs
    #[arg(long = "log.format", value_enum, default_value_t = LogFormat::Text, env = "LOG_FORMAT")]
    pub logs_format: LogFormat,
    /// The directory to store the logs
    #[arg(long = "log.file.dir", default_value = "./logs", env = "LOG_DIR")]
    pub logs_file_dir: PathBuf,
    /// The base name for log files
    #[arg(long = "log.file.name", default_value = "altindexer.log", env = "LOG_FILE_NAME")]
    pub logs_file_name: String,
    /// Maximum size of a single log file in megabytes (MB)
    #[arg(long = "log.file.max-size-mb", default_value_t = 100, env = "MAX_LOG_SIZE_MB")]
    pub max_log_size_mb: u64,
    /// Maximum number of rotated log files to keep
    #[arg(long = "log.file.max-files", default_value_t = 5, env = "MAX_LOG_FILES")]
    pub max_log_files: usize,
}

/// A worker guard returned by the file layer.
/// When a guard is dropped, all events currently in-memory are flushed to the log file.
pub(crate) type FileWorkerGuard = WorkerGuard;

/// A boxed tracing Layer.
type BoxedLayer<S> = Box<dyn Layer<S> + Send + Sync>;

/// Defines the format for log messages.
#[derive(Debug, Copy, Clone, ValueEnum, Eq, PartialEq)]
pub(crate) enum LogFormat {
    /// Plain text format.
    Text,
    /// JSON format.
    Json,
}

impl fmt::Display for LogFormat {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Text => write!(f, "text"),
            Self::Json => write!(f, "json"),
        }
    }
}

impl LogFormat {
    /// Applies the specified logging format to create a new layer.
    fn apply_file_format<S>(
        &self,
        builder: tracing_subscriber::fmt::Layer<S, DefaultFields, Format, NonBlocking>,
        filter: EnvFilter,
    ) -> BoxedLayer<S>
    where
        S: Subscriber + for<'a> LookupSpan<'a>,
    {
        match self {
            Self::Text => builder.with_filter(filter).boxed(),
            Self::Json => builder.json().with_filter(filter).boxed(),
        }
    }

    fn apply_stdout_format<S>(
        &self,
        builder: tracing_subscriber::fmt::Layer<S, DefaultFields, Format, fn() -> std::io::Stdout>,
        filter: EnvFilter,
    ) -> BoxedLayer<S>
    where
        S: Subscriber + for<'a> LookupSpan<'a>,
    {
        match self {
            Self::Text => builder.with_filter(filter).boxed(),
            Self::Json => builder.json().with_filter(filter).boxed(),
        }
    }
}

/// Configuration for file-based logging.
#[derive(Debug, Clone)]
pub(crate) struct LogFileConfig {
    /// Directory where log files will be stored.
    pub dir: PathBuf,
    /// Base name for log files.
    pub file_name: String,
    /// Maximum size of a single log file in bytes.
    pub max_size_bytes: u64,
    /// Maximum number of rotated log files to keep.
    pub max_files: usize,
}

impl LogFileConfig {
    /// Creates a new `LogFileConfig`.
    pub(crate) const fn new(
        dir: PathBuf,
        file_name: String,
        max_size_bytes: u64,
        max_files: usize,
    ) -> Self {
        Self { dir, file_name, max_size_bytes, max_files }
    }

    /// Creates the log directory if it doesn't exist and returns the full path to the log file.
    fn ensure_log_dir_and_get_path(&self) -> PathBuf {
        if !self.dir.exists() {
            std::fs::create_dir_all(&self.dir).expect("Could not create log directory");
        }
        self.dir.join(&self.file_name)
    }

    /// Creates a non-blocking writer for the log file with size-based rotation.
    fn create_writer(&self) -> (NonBlocking, FileWorkerGuard) {
        let log_file_path = self.ensure_log_dir_and_get_path();
        let appender = RollingFileAppenderLib::new(
            log_file_path,
            RollingConditionBasic::new().max_size(self.max_size_bytes),
            self.max_files,
        )
        .expect("Failed to initialize rolling file appender");

        tracing_appender::non_blocking(appender)
    }
}

fn build_common_env_filter(default_directive: Directive) -> EnvFilter {
    EnvFilter::builder()
        .with_default_directive(default_directive)
        .from_env_lossy()
        .add_directive("actix_server=off".parse().unwrap())
        .add_directive("hyper::proto::h1=off".parse().unwrap())
        .add_directive("sqlx=off".parse().unwrap())
        .add_directive("alloy=off".parse().unwrap())
        .add_directive("hyper_util=off".parse().unwrap())
}

fn create_stdout_layer<S: Subscriber + for<'a> LookupSpan<'a>>(
    log_format: LogFormat,
    base_default_directive: Directive,
) -> BoxedLayer<S> {
    let env_filter = build_common_env_filter(base_default_directive);

    let use_ansi = match log_format {
        LogFormat::Text => true,
        LogFormat::Json => std::env::var("RUST_LOG_STYLE").map_or(true, |s| s != "never"),
    };

    let layer_builder = tracing_subscriber::fmt::layer()
        .with_ansi(use_ansi)
        .with_target(true);
    log_format.apply_stdout_format(layer_builder, env_filter)
}

fn create_file_layer<S: Subscriber + for<'a> LookupSpan<'a>>(
    log_format: LogFormat,
    file_config: &LogFileConfig,
) -> (BoxedLayer<S>, FileWorkerGuard) {
    let file_default_directive = LevelFilter::TRACE.into();
    let env_filter = build_common_env_filter(file_default_directive);
    let (file_writer, guard) = file_config.create_writer();
    let layer_builder = tracing_subscriber::fmt::layer()
        .with_ansi(false)
        .with_target(true)
        .with_writer(file_writer);
    let layer = log_format.apply_file_format(layer_builder, env_filter);
    (layer, guard)
}

/// Initializes the tracing system.
///
/// If `file_log_config` is `Some`, sets up file logging according to `log_format` from `LogsArgs`
/// and stdout logging according to `stdout_log_format`.
/// If `file_log_config` is `None` (e.g. for `db` command), sets up stdout logging only,
/// with `LogFormat::Text` and a default `RUST_LOG` level.
///
/// # Returns
/// A `Result` containing an `Option<FileWorkerGuard>` if successful, or an error.
/// The guard must be kept alive for the duration of the application to ensure logs are flushed.
pub(crate) fn init_tracing(
    stdout_log_format: LogFormat,
    file_log_config: Option<(LogFormat, LogFileConfig)>,
) -> Result<Option<FileWorkerGuard>, tracing_subscriber::util::TryInitError> {
    let rust_log_env = std::env::var("RUST_LOG").unwrap_or_else(|_| "info".to_string());
    let base_default_directive =
        Directive::from_str(&rust_log_env).unwrap_or_else(|_| Directive::from_str("info").unwrap());

    let stdout_layer = create_stdout_layer(stdout_log_format, base_default_directive);

    if let Some((file_format, config)) = file_log_config {
        let (file_layer, file_guard) = create_file_layer(file_format, &config);

        tracing_subscriber::registry()
            .with(stdout_layer)
            .with(file_layer)
            .try_init()?;
        Ok(Some(file_guard))
    } else {
        tracing_subscriber::registry()
            .with(stdout_layer)
            .try_init()?;
        Ok(None)
    }
}
