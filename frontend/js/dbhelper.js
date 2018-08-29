function put(url, data) {
	return fetch(url, {
		method: 'post',
		headers: {
			'Accept': 'application/json',
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(data)
	});
}

// Used to enable useful debug logs
var DEBUG = false;

/**
	* Common database helper functions.
*/
class DBHelper {
	// RESTAURANTS CACHE
	static async initializeIndexedRestaurantsDB() {
		var indexedDBOpenerPromise = new Promise(function(resolve, reject) 
		{
			// This works on all devices/browsers, and uses IndexedDBShim as a final fallback 
			var indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB || window.shimIndexedDB;
			
			// Open (or create) the database
			var open = indexedDB.open("restaurants-cache", 1);
			
			// Create the schema
			open.onupgradeneeded = function() {
				var db = open.result;
				var store = db.createObjectStore("restaurants", {keyPath: "id", autoIncrement:true});
				var nameIndex = store.createIndex("NameIndex", ["name"]);
				var neighborhoodIndex = store.createIndex("NeighborhoodIndex", ["neighborhood"]);
			};
			
			open.onsuccess = function() {
				var db = open.result;
				resolve(db);
			};
		});
		var db = await indexedDBOpenerPromise;
		return new Promise(function(resolve, reject) { resolve(db); });
	}
	
	static async updateCachedRestaurants(restaurants) {
		var db = await DBHelper.initializeIndexedRestaurantsDB();
		
		var updateCachedRestaurantsPromise = new Promise(async function(resolve, reject)
		{
			var tx = db.transaction("restaurants", "readwrite");
			var store = tx.objectStore("restaurants");
			restaurants.forEach((restaurant) => {
				try {
					store.put(restaurant);
				} catch(e) { console.log(restaurant, e); }
			});
			// Close the db when the transaction is done
			tx.oncomplete = function() {
				db.close();
				resolve();
			};
			tx.onerror = function() {
				reject();
			};
		});
		return await updateCachedRestaurantsPromise;
	}
	
	/**
		* Toggles a restaurants favorite status.
	*/
	static async toggleRestaurantFavorite(restaurant_id, is_favorite) {
		if(DEBUG) console.log("toggleRestaurantFavorite", restaurant_id, is_favorite);
		var db = await DBHelper.initializeIndexedRestaurantsDB();
		
		var updateCachedRestaurantsPromise = new Promise(async function(resolve, reject)
		{
			var tx = db.transaction("restaurants", "readwrite");
			var store = tx.objectStore("restaurants");
			var cursor = await store.openCursor();
			cursor.onsuccess = async function(event) {
				var cursor = event.target.result;
				if(cursor) {
					try {
						var updateData = cursor.value;
						if(cursor.value.id == restaurant_id) {
							updateData.is_favorite = is_favorite;
							await cursor.update(updateData);
							resolve();
						} else {
							cursor.continue();
						}
					} catch(e) { console.log("Error modifying favorite status for restaurant with id: ", restaurant_id, e); }
				}
			};
			cursor.onerror = function() {
				reject();
			};

			// Close the db when the transaction is done
			tx.oncomplete = function() {
				db.close();
				resolve();
			};
			tx.onerror = function() {
				reject();
			};
		});
		
		await updateCachedRestaurantsPromise;
		try {
			await put(DBHelper.TOGGLE_FAVORITE_URL(restaurant_id, is_favorite), {});
		} catch(e) { console.error("Could not send favorite status to server"); };
		return await updateCachedRestaurantsPromise;
	}
	
	static async getCachedRestaurants(includeReviews) {
		var db = await DBHelper.initializeIndexedRestaurantsDB();
		
		// Start a new transaction
		var tx = db.transaction("restaurants", "readwrite");
		var store = tx.objectStore("restaurants");
		
		var getAllRestaurantsPromise = new Promise(async function(resolve, reject) {
			var allRestaurants = await store.getAll();
			allRestaurants.onsuccess = function() {
				resolve(allRestaurants.result);
			};
			allRestaurants.onerror = function() {
				reject();
			};
			tx.oncomplete = function() {
				db.close();
			};
		});
		var restaurants = await getAllRestaurantsPromise;
		if(includeReviews) {
			// If we should include reviews of restaurant we add them here
			for(var ii = 0; ii < restaurants.length; ii++) {
				var restaurant = restaurants[ii];
				restaurant.reviews = await DBHelper.getCachedReviews(restaurant.id);
			}
		} else {
			for(var ii = 0; ii < restaurants.length; ii++) {
				var restaurant = restaurants[ii];
				restaurant.reviews = [];
			}
		}
		return new Promise(function(resolve,reject) { resolve(restaurants); });
	}
	
	static cacheStoreRestaurant(restaurant) {
		DBHelper.initializeIndexedRestaurantsDB((db) => {
			// Start a new transaction
			var tx = db.transaction("restaurants", "readwrite");
			var store = tx.objectStore("restaurants");
			
			store.put(restaurant);
			
			// Close the db when the transaction is done
			tx.oncomplete = function() {
				db.close();
			};
		});
	}
	
	// REVIEWS CACHE
	static async initializeIndexedReviewsDB() {
		var indexedDBOpenerPromise = new Promise(function(resolve, reject) 
		{
			// This works on all devices/browsers, and uses IndexedDBShim as a final fallback 
			var indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB || window.shimIndexedDB;
			
			// Open (or create) the database
			var open = indexedDB.open("reviews-cache", 1);
			
			// Create the schema
			open.onupgradeneeded = function() {
				var db = open.result;
				var store = db.createObjectStore("reviews", {keyPath: "id", autoIncrement:true});
				var nameIndex = store.createIndex("NameIndex", ["name"]);
				var neighborhoodIndex = store.createIndex("NeighborhoodIndex", ["neighborhood"]);
			};
			
			open.onsuccess = function() {
				var db = open.result;
				resolve(db);
			};
		});
		var db = await indexedDBOpenerPromise;
		return new Promise(function(resolve, reject) { resolve(db); });
	}
	
	static async updateCachedReviews(reviews) {
		var db = await DBHelper.initializeIndexedReviewsDB();
		
		var updateCachedReviewsPromise = new Promise(async function(resolve, reject)
		{
			var tx = db.transaction("reviews", "readwrite");
			var store = tx.objectStore("reviews");
			reviews.forEach((restaurant) => {
				store.put(restaurant);
			});
			// Close the db when the transaction is done
			tx.oncomplete = function() {
				db.close();
				resolve();
			};
			tx.onerror = function() {
				reject();
			};
		});
		return await updateCachedReviewsPromise;
	}
	
	static async getCachedReviews(restaurantId) {
		var db = await DBHelper.initializeIndexedReviewsDB();
		
		// Start a new transaction
		var tx = db.transaction("reviews", "readwrite");
		var store = tx.objectStore("reviews");
		
		var getAllReviewsPromise = new Promise(async function(resolve, reject) {
			var allReviews = await store.getAll();
			allReviews.onsuccess = function() {
				resolve(allReviews.result);
			};
			allReviews.onerror = function() {
				reject();
			};
			tx.oncomplete = function() {
				db.close();
			};
		});
		var reviews = await getAllReviewsPromise;
		var restaurantReviews = [];
		// Filter the reviews to the restaurant
		reviews.forEach((review) => {
			if(review.restaurant_id == restaurantId) {
				restaurantReviews.push(review);
			}
		});
		
		return new Promise(function(resolve,reject) { resolve(restaurantReviews); });
	}
	
	static async cacheStoreReview(review) {
		var db = await DBHelper.initializeIndexedReviewsDB();
		var updateCachedReviewsPromise = new Promise(async function(resolve, reject)
		{
			// Start a new transaction
			var tx = db.transaction("reviews", "readwrite");
			var store = tx.objectStore("reviews");
			
			await store.put(review);
			
			// Close the db when the transaction is done
			tx.oncomplete = function() {
				db.close();
				resolve();
			};
			tx.onerror = function() {
				reject();
			};
		});
		
		// Restore self.restaurant after updateCachedReviewsPromise mysteriously sets it to null
		var temp = null;
		if(self.restaurant) temp = JSON.parse(JSON.stringify(self.restaurant)); 
		await updateCachedReviewsPromise;
		if(temp) self.restaurant = temp;
		return new Promise(function(resolve,reject) { resolve(); });
	}
	
	static async removeCachedReview(review_id) {
		var db = await DBHelper.initializeIndexedReviewsDB();
		var updateCachedReviewsPromise = new Promise(async function(resolve, reject)
		{
			// Start a new transaction
			var tx = db.transaction("reviews", "readwrite");
			var store = tx.objectStore("reviews");
			
			await store.delete(review_id);
			
			// Close the db when the transaction is done
			tx.oncomplete = function() {
				db.close();
				resolve();
			};
			tx.onerror = function() {
				reject();
			};
		});
		return await updateCachedReviewsPromise;
	}
	
	static async storeUserReviews() {
		var result = true;
		var allReviews = await DBHelper.getCachedReviews(self.restaurant.id);
		if(DEBUG) console.log("Checking reviews for unsent reviews...", allReviews.length);
		var userReviews = 0;
		var successfullySentUserReviews = 0;
		for(var ii = 0; ii < allReviews.length; ii++) {
			var curReview = allReviews[ii];
			if(curReview.is_user_review) {
				userReviews++;
				var newUserReview = JSON.parse(JSON.stringify(curReview));
				// Ensure we get a fresh id from database and we don't store temporary data
				delete(newUserReview.id);
				delete(newUserReview.is_user_review);
				if(DEBUG) console.log("Sending", newUserReview);
				try {
					var putResult = await put(DBHelper.REVIEW_PUT_URL, newUserReview);
					if(DEBUG) console.log("PUT result: ", putResult);
					if(!putResult || putResult.status !== 201 /* Created */) {
						var jsonResult = await putResult.json();
						if(DEBUG) console.log("PUT DATA:", jsonResult);
						result = false;
						break;
					} else {
						// If we successfully store a user review, we have to update the cached version to reflect the changes
						successfullySentUserReviews++;
						var jsonResult = await putResult.json();
						if(DEBUG) console.log("PUT DATA:", jsonResult);
						try {
							await DBHelper.removeCachedReview(curReview.id);
							await DBHelper.cacheStoreReview(jsonResult);
						} catch(e) { console.log("Could not update local cached version of review", e); };
					}
				} catch(e) { console.log("Could not put review", e); };
			}
		}
		if(DEBUG) console.log("User reviews found: ", userReviews);
		if(result && userReviews > successfullySentUserReviews) result = false;
		return result;
	}
	
	/**
		* Database URL.
		* Change this to restaurants.json file location on your server.
	*/
	static get DATABASE_URL() {
		const port = 1337 // Change this to your server port
		return `http://localhost:${port}/restaurants`;
	}
	
	/**
		* ALL reviews URL.
	*/
	static get REVIEWS_URL() {
		const port = 1337 // Change this to your server port
		return `http://localhost:${port}/reviews/`;
	}
	
	/**
		* URL for storing a review.
	*/
	static get REVIEW_PUT_URL() {
		const port = 1337 // Change this to your server port
		return `http://localhost:${port}/reviews`;
	}
	
	/**
		* URL for toggling restaurant favorite.
	*/
	static TOGGLE_FAVORITE_URL(restaurant_id, is_favorite) {
		const port = 1337 // Change this to your server port
		return `http://localhost:${port}/restaurants/${restaurant_id}/?is_favorite=${is_favorite}`;
	}
	
	/**
		* Fetch all restaurants.
	*/
	static async fetchRestaurants(callback, includeReviews) {
		var restaurants = await DBHelper.getCachedRestaurants(includeReviews);

		// Send cached restaurants to UI
		if(restaurants.length > 0) callback(null, restaurants);

		try {
			var fetchResult = await fetch(DBHelper.DATABASE_URL);
			if (fetchResult.status === 200) { // Got a success response from server!
				const fetchedRestaurants = await fetchResult.json();
				for(var ii = 0; ii < fetchedRestaurants.length; ii++) {
					var fetchedRestaurant = fetchedRestaurants[ii];
					var found = false;
					for(var jj = 0; jj < restaurants.length; jj++) {
						var existingRestaurant = restaurants[jj];
						if(fetchedRestaurant.id == existingRestaurant.id) {
							found = true;
							break;
						}
					}
					if(!found) {
						restaurants.push(fetchedRestaurant);
					}
				}
				DBHelper.updateCachedRestaurants(restaurants);

				restaurants.forEach(async (restaurant) => {
					for(var kk = 0; restaurant.reviews && kk < restaurant.reviews.length; kk++) {
						var userReview = restaurant.reviews[kk];
						if(userReview.id == null) {
							// We have an existing user review that should be sent to the server
							if(DEBUG) console.log("Sending users review to server...");
							var putResult = await put(DBHelper.REVIEW_PUT_URL, userReview);
							if(putResult.result == "success") {
								if(putResult && putResult.data && putResult.data.id) {
									// Set the reviews id to the newly created one
									userReview.id = putResult.data.id;
								} else {
									// If we did not get a review id back from server but it was a success to add it, we have to fetch it from server.
									restaurant.reviews.splice(kk, 1);
									kk--;
								}
							}
						}
					}
				});
				
				// Fetch ALL reviews, then assign them to the correct restaurants
				try {
					var fetchReviews = await fetch(DBHelper.REVIEWS_URL);
					if(fetchReviews.status === 200) {
						var fetchedReviews = await fetchReviews.json();

						for(var ii = 0; ii < fetchedReviews.length; ii++) {
							var fetchedReview = fetchedReviews[ii];
							var d = new Date(0); // The 0 there is the key, which sets the date to the epoch
							d.setUTCSeconds(fetchedReview.createdAt/1000);
							fetchedReview.date = d.toLocaleDateString();
							for(var jj = 0; jj < restaurants.length; jj++) {
								var restaurant = restaurants[jj];
								if(fetchedReview.restaurant_id === restaurant.id) { // Only consider reviews that belong to this restaurant
									if(!restaurant.reviews) {
										restaurant.reviews = [];
									}
									
									var found = false;
									for(var kk = 0; kk < restaurant.reviews.length; kk++) {
										var curRestaurantReview = restaurant.reviews[kk];
										if(curRestaurantReview.id == fetchedReview.id) {
											found = true;
										}
									}
									
									if(!found) {
										restaurant.reviews.push(fetchedReview);
										if(DEBUG) console.log("The online review was added to local cache: " + fetchedReview.id);
										DBHelper.cacheStoreReview(fetchedReview);
									} else {
										if(DEBUG) console.log("The online review was already in local cache: " + fetchedReview.id);
									}
								}
							}
						}
					}
				} catch(e) { console.log("Could not fetch reviews, serving cached version of reviews."); }
				// Send restaurants fetched from server to UI
				callback(null, restaurants);
			} else { // Oops!. Got an error from server.
				const error = (`Request failed.`);
				callback(error, null);
			}
		} catch(e) { 
			const error = ("Could not fetch restaurants, serving cached version of restaurants.");
			console.log(error); 
			callback(error, null);
		}
	}
	
	/**
		* Fetch a restaurant by its ID.
	*/
	static fetchRestaurantById(id, callback) {
		// fetch all restaurants with proper error handling.
		DBHelper.fetchRestaurants((error, restaurants) => {
			if (error) {
				callback(error, null);
				} else {
				const restaurant = restaurants.find(r => r.id == id);
				if (restaurant) { // Got the restaurant
					callback(null, restaurant);
					} else { // Restaurant does not exist in the database
					callback('Restaurant does not exist', null);
				}
			}
		}, true);
	}
	
	/**
		* Fetch restaurants by a cuisine type with proper error handling.
	*/
	static fetchRestaurantByCuisine(cuisine, callback) {
		// Fetch all restaurants  with proper error handling
		DBHelper.fetchRestaurants((error, restaurants) => {
			if (error) {
				callback(error, null);
				} else {
				// Filter restaurants to have only given cuisine type
				const results = restaurants.filter(r => r.cuisine_type == cuisine);
				callback(null, results);
			}
		});
	}
	
	/**
		* Fetch restaurants by a neighborhood with proper error handling.
	*/
	static fetchRestaurantByNeighborhood(neighborhood, callback) {
		// Fetch all restaurants
		DBHelper.fetchRestaurants((error, restaurants) => {
			if (error) {
				callback(error, null);
				} else {
				// Filter restaurants to have only given neighborhood
				const results = restaurants.filter(r => r.neighborhood == neighborhood);
				callback(null, results);
			}
		});
	}
	
	/**
		* Fetch restaurants by a cuisine and a neighborhood with proper error handling.
	*/
	static fetchRestaurantByCuisineAndNeighborhood(cuisine, neighborhood, callback) {
		// Fetch all restaurants
		DBHelper.fetchRestaurants((error, restaurants) => {
			if (error) {
				callback(error, null);
				} else {
				let results = restaurants
				if (cuisine != 'all') { // filter by cuisine
					results = results.filter(r => r.cuisine_type == cuisine);
				}
				if (neighborhood != 'all') { // filter by neighborhood
					results = results.filter(r => r.neighborhood == neighborhood);
				}
				callback(null, results);
			}
		});
	}
	
	/**
		* Fetch all neighborhoods with proper error handling.
	*/
	static fetchNeighborhoods(callback) {
		// Fetch all restaurants
		DBHelper.fetchRestaurants((error, restaurants) => {
			if (error) {
				callback(error, null);
				} else {
				// Get all neighborhoods from all restaurants
				const neighborhoods = restaurants.map((v, i) => restaurants[i].neighborhood)
				// Remove duplicates from neighborhoods
				const uniqueNeighborhoods = neighborhoods.filter((v, i) => neighborhoods.indexOf(v) == i)
				callback(null, uniqueNeighborhoods);
			}
		});
	}
	
	/**
		* Fetch all cuisines with proper error handling.
	*/
	static fetchCuisines(callback) {
		// Fetch all restaurants
		DBHelper.fetchRestaurants((error, restaurants) => {
			if (error) {
				callback(error, null);
				} else {
				// Get all cuisines from all restaurants
				const cuisines = restaurants.map((v, i) => restaurants[i].cuisine_type)
				// Remove duplicates from cuisines
				const uniqueCuisines = cuisines.filter((v, i) => cuisines.indexOf(v) == i)
				callback(null, uniqueCuisines);
			}
		});
	}
	
	/**
		* Restaurant page URL.
	*/
	static urlForRestaurant(restaurant) {
		return (`./restaurant.html?id=${restaurant.id}`);
	}
	
	/**
		* Restaurant image URL.
	*/
	static imageUrlForRestaurant(restaurant) {
		return (`/img/${restaurant.photograph}.webp`);
	}
	
	/**
		* Map marker for a restaurant.
	*/
	static mapMarkerForRestaurant(restaurant, map) {
		if(restaurant != null && restaurant.latlng != null) {
			try {
				// https://leafletjs.com/reference-1.3.0.html#marker  
				const marker = new L.marker([restaurant.latlng.lat, restaurant.latlng.lng],
				{title: restaurant.name,
					alt: restaurant.name,
					url: DBHelper.urlForRestaurant(restaurant)
				})
				marker.addTo(newMap);
				return marker;
			} catch(e) { console.log(e); }
		}
		return null;
	} 
	/* static mapMarkerForRestaurant(restaurant, map) {
		const marker = new google.maps.Marker({
		position: restaurant.latlng,
		title: restaurant.name,
		url: DBHelper.urlForRestaurant(restaurant),
		map: map,
		animation: google.maps.Animation.DROP}
		);
		return marker;
	} */
	
}
