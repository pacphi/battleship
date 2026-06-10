/// Public library surface for cog-battleship.
///
/// Exposes the signal room store so integration tests in tests/ can
/// drive the real room logic without going through the HTTP layer.
pub mod signal;
