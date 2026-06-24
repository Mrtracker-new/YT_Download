pub mod job;
pub mod manager;
pub use job::{DownloadJob, DownloadOptions, JobStatus};
pub use manager::DownloadManager;
