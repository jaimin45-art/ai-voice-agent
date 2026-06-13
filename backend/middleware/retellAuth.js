
function verifyRetellSignature(req, res, next) {
  try {
    req.body = JSON.parse(req.body.toString());
  } catch (e) {
    return res.status(400).json({ error: "Invalid JSON body" });
  }
  next();
}

module.exports = { verifyRetellSignature };