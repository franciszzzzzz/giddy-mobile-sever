export default (myErrorHandler) => (req, res, next) => {
  Promise.resolve(myErrorHandler(req, res, next)).catch(next);
};
