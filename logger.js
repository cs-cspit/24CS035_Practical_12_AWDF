function logger(req, res, next) {
    if (process.env.NODE_ENV !== "test") {
        console.log(`${req.method} ${req.url} - ${new Date().toLocaleString()}`);
    }
    next();
}

module.exports = logger;
