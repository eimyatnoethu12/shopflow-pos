export function notFound(req, res) { res.status(404).json({ message: 'Not found' }); }
export function errorHandler(err, req, res, next) {
  console.error(err);
  if (err?.name === 'ZodError') return res.status(400).json({ message: 'Invalid input', errors: err.errors });
  res.status(err.status || 500).json({ message: err.status ? err.message : 'Server error' });
}
