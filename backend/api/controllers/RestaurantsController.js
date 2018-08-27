/**
 * RestaurantsController
 *
 * @description :: Server-side logic for managing restaurants
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */

module.exports = {
	restaurants: function (req, res) { 
		sails.log.silly('restaurants');
		sails.log.silly('restaurants', req.allParams());
		sails.log.silly(req.query.is_favorite);
	},
	is_favorite: function (req, res) { 
		sails.log.silly('is_favorite');
		res.status(200); res.jsonx({result: "OK"}); 
	},
};
