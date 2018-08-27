/**
	* Common database helper functions.
*/
class DBHelper {
	
	static async initializeIndexedDB() {
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
		var db = await DBHelper.initializeIndexedDB();
		
		var updateCachedRestaurantsPromise = new Promise(async function(resolve, reject)
		{
			var tx = db.transaction("restaurants", "readwrite");
			var store = tx.objectStore("restaurants");
			restaurants.forEach((restaurant) => {
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
		return await updateCachedRestaurantsPromise;
	}
	
	static async getCachedRestaurants() {
		var db = await DBHelper.initializeIndexedDB();
		
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
		return new Promise(function(resolve,reject) { resolve(restaurants); });
	}
	
	static cacheStoreRestaurant(restaurant) {
		DBHelper.initializeIndexedDB((db) => {
			// Start a new transaction
			var tx = db.transaction("restaurants", "write");
			var store = tx.objectStore("restaurants");
			
			store.put(restaurant);
			
			// Close the db when the transaction is done
			tx.oncomplete = function() {
				db.close();
			};
		});
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
		* Fetch all restaurants.
	*/
	static async fetchRestaurants(callback) {
		let xhr = new XMLHttpRequest();
		var restaurants = await DBHelper.getCachedRestaurants();
		// Send cached restaurants to UI
		if(restaurants.length > 0) callback(null, restaurants);
		xhr.open('GET', DBHelper.DATABASE_URL);
		xhr.onload = () => {
			if (xhr.status === 200) { // Got a success response from server!
				const json = JSON.parse(xhr.responseText);
				const restaurants = json;
				DBHelper.updateCachedRestaurants(restaurants);
				// Send restaurants fetched from server to UI
				callback(null, restaurants);
				} else { // Oops!. Got an error from server.
				const error = (`Request failed. Returned status of ${xhr.status}`);
				callback(error, null);
			}
		};
		xhr.send();
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
		});
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

