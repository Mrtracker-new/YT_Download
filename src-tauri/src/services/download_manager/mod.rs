pub mod job;
pub mod manager;
pub use manager::DownloadManager;
pub use job::{DownloadJob, JobStatus, DownloadOptions};
