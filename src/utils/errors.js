export class ApiError extends Error {
  constructor(status, code, message, details = undefined) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: { code: "ROUTE_NOT_FOUND", message: `Route ${req.method} ${req.path} was not found.` }
  });
}

export function errorHandler(error, _req, res, _next) {
  const status = Number.isInteger(error.status) ? error.status : 500;
  if (status >= 500) console.error(`[API error] ${error.code || "INTERNAL_ERROR"}: ${error.message}`);
  const body = {
    success: false,
    error: {
      code: error.code || "INTERNAL_ERROR",
      message: status === 500 ? "An unexpected server error occurred." : error.message
    }
  };
  if (error.details && process.env.NODE_ENV !== "production") body.error.details = error.details;
  res.status(status).json(body);
}
