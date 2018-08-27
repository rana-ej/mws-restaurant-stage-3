module.exports = async function welcomeUser (req, res) {
		sails.log.silly('restaurants');
		sails.log.silly('restaurants', req.allParams());
		sails.log.silly(req.query.is_favorite);
};
