export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  let message = err.message || 'An unexpected error occurred. Please try again.';

  // Ensure no API keys or tokens leak in error messages
  if (
    message.includes('MISTRAL_API_KEY') ||
    message.includes('GROQ_API_KEY') ||
    message.includes('Bearer') ||
    message.includes('gsk_')
  ) {
    message = 'An authentication error occurred with an external service.';
  }

  console.error('[Error Handler]:', err.message || err);

  res.status(statusCode).json({
    success: false,
    error: message,
  });
};
