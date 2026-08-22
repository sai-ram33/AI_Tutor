export const errorHandler = (err, req, res, next) => {
  console.error('[Error Handler]:', err.message || err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'An unexpected error occurred. Please try again.';

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
