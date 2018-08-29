let restaurant;
var newMap;

/**
	* Initialize map as soon as the page is loaded.
*/
document.addEventListener('DOMContentLoaded', (event) => {  
	initMap();
});

const timeout = (ms) => new Promise((res) => setTimeout(res, ms));

storeUserReviewsWithRetry = async () => {
	if(DEBUG) console.log("storeUserReviewsWithRetry...");
	var result = false;
	while(!result) {
		try {
			if(navigator.onLine) {
				result = await DBHelper.storeUserReviews();
			}
		} catch(e) { if(DEBUG) console.log("storeUserReviews", e); };
		
		if(!result) {
			await timeout(500);
		} else {
			if(DEBUG) console.log("success", result);
		}
	}
}

submitUserReview = async (name, rating, comment) => {
	fetchRestaurantFromURL(async (error, restaurant) => {
		try {
			const restaurant_id = self.restaurant.id;
			var userReview = {restaurant_id: restaurant_id, name: name, rating: parseInt(rating), comments: comment, date: new Date().toLocaleString(), is_user_review: true};
			// Store the users review to local cache so it can be displayed while offline
			await DBHelper.cacheStoreReview(userReview);
			
			if(!self.restaurant.reviews) self.restaurant.reviews = [];
			self.restaurant.reviews.push(userReview);
			fillReviewsHTML();
			clearReviewForm();
			
			// Then trigger a timer that will send to server, or if no internet, retry after a delay.
			await storeUserReviewsWithRetry();
		} catch(e) { console.error(e); };
	});
}

/**
	* Initialize leaflet map
*/
initMap = async () => {
	await fetchRestaurantFromURL((error, restaurant) => {
		if (error) { // Got an error!
			console.error(error);
		} else {
			try {
				if(self.newMap == null)
				{
					self.newMap = L.map('map', {
						center: [restaurant.latlng.lat, restaurant.latlng.lng],
						zoom: 16,
						scrollWheelZoom: false
					});
				}
				L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.jpg70?access_token={mapboxToken}', {
					mapboxToken: 'pk.eyJ1IjoicmFuYS1laiIsImEiOiJjamt6aWFsMzYwYWF3M3BucXNnd2JkNDF6In0.WvoQqcaFgoTh5z-pb5fstA',
					maxZoom: 18,
					attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, ' +
					'<a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
					'Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
					id: 'mapbox.streets'    
				}).addTo(self.newMap);
				fillBreadcrumb();
				DBHelper.mapMarkerForRestaurant(self.restaurant, self.newMap);
			} catch(e) { console.log(e); }
		}
	});
}  

/* window.initMap = () => {
	fetchRestaurantFromURL((error, restaurant) => {
    if (error) { // Got an error!
	console.error(error);
    } else {
	self.map = new google.maps.Map(document.getElementById('map'), {
	zoom: 16,
	center: restaurant.latlng,
	scrollwheel: false
	});
	fillBreadcrumb();
	DBHelper.mapMarkerForRestaurant(self.restaurant, self.map);
    }
	});
} */

/**
	* Get current restaurant from page URL.
*/
fetchRestaurantFromURL = (callback) => {
	if (self.restaurant) { // restaurant already fetched!
		callback(null, self.restaurant)
		return;
	}
	const id = getParameterByName('id');
	if (!id) { // no id found in URL
		error = 'No restaurant id in URL'
		callback(error, null);
	} else {
		DBHelper.fetchRestaurantById(id, (error, restaurant) => {
			self.restaurant = JSON.parse(JSON.stringify(restaurant));
			if (!self.restaurant) {
				console.error(error);
				return;
			}
			fillRestaurantHTML();
			callback(null, JSON.parse(JSON.stringify(restaurant)))
		});
	}
}

/**
	* Create restaurant HTML and add it to the webpage
*/
fillRestaurantHTML = (restaurant = self.restaurant) => {
	const name = document.getElementById('restaurant-name');
	name.innerHTML = restaurant.name;

	const address = document.getElementById('restaurant-address');
	address.innerHTML = restaurant.address;

	const image = document.getElementById('restaurant-img');
	image.className = 'restaurant-img'
	image.src = DBHelper.imageUrlForRestaurant(restaurant);
	image.alt = restaurant.name;

	const cuisine = document.getElementById('restaurant-cuisine');
	cuisine.innerHTML = restaurant.cuisine_type;

	const is_favorite = document.getElementById('restaurant-favorite');
	// Initialize correct state for favorite button
	if (restaurant.is_favorite == true) {
		is_favorite.className = 'icon-heart-1 unselectable';
		is_favorite.setAttribute("aria-label", "Remove from favorite");
	} else {
		is_favorite.className = 'icon-heart-empty-1 unselectable';
		is_favorite.setAttribute("aria-label", "Save as favorite");
	}
	
	is_favorite.tabIndex = "0";
	var onFavoriteClick = () => { 
		if(restaurant.is_favorite) {
			restaurant.is_favorite = false; 
			is_favorite.className = 'icon-heart-empty-1 unselectable';
			is_favorite.setAttribute("aria-label", "Save as favorite");
		} else { 
			restaurant.is_favorite = true;
			is_favorite.className = 'icon-heart-1 unselectable';
			is_favorite.setAttribute("aria-label", "Remove from favorite");
		}
		DBHelper.toggleRestaurantFavorite(restaurant.id, restaurant.is_favorite);
	};

	if(!is_favorite.onclick) {
		is_favorite.onclick = onFavoriteClick;
	}
	
	// fill operating hours
	if (restaurant.operating_hours) {
		fillRestaurantHoursHTML();
	}
	// fill reviews
	fillReviewsHTML();
}

/**
* Create restaurant operating hours HTML table and add it to the webpage.
*/
fillRestaurantHoursHTML = (operatingHours = self.restaurant.operating_hours) => {
	const hours = document.getElementById('restaurant-hours');
	while (hours.firstChild) {
		hours.removeChild(hours.firstChild);
	}
	for (let key in operatingHours) {
		const row = document.createElement('tr');

		const day = document.createElement('td');
		day.innerHTML = key;
		row.appendChild(day);

		const time = document.createElement('td');
		time.innerHTML = operatingHours[key];
		row.appendChild(time);

		hours.appendChild(row);
	}
}

/**
* Create all reviews HTML and add them to the webpage.
*/
fillReviewsHTML = (reviews = self.restaurant.reviews) => {
	const container = document.getElementById('reviews-container');
	while (container.firstChild) {
		container.removeChild(container.firstChild);
	}
	const title = document.createElement('h2');
	title.innerHTML = 'Reviews';
	container.appendChild(title);

	if (!reviews) {
		const noReviews = document.createElement('p');
		noReviews.innerHTML = 'No reviews yet!';
		container.appendChild(noReviews);
		return;
	}
	const ul = document.createElement('ul');
	ul.id = "reviews-list";
	if(reviews != null) {
		reviews.forEach(review => {
			ul.appendChild(createReviewHTML(review));
		});
	}
	container.appendChild(ul);
}

/**
* Create review HTML and add it to the webpage.
*/
createReviewHTML = (review) => {
	const li = document.createElement('li');
	li.className = 'review-item';

	const header = document.createElement('div');
	header.className = 'review-header';
	li.appendChild(header);

	const name = document.createElement('p');
	name.className = 'review-name';
	name.innerHTML = review.name;
	header.appendChild(name);

	const rating = document.createElement('p');
	rating.className = 'review-rating';
	rating.innerHTML = `Rating: ${review.rating}`;
	header.appendChild(rating);

	const body = document.createElement('div');
	body.className = 'review-body';
	li.appendChild(body);

	const date = document.createElement('p');
	date.className = 'review-date';
	date.innerHTML = review.date;
	body.appendChild(date);

	const comments = document.createElement('p');
	comments.className = 'review-comment';
	comments.innerHTML = review.comments;
	body.appendChild(comments);

	return li;
}

/**
* Add restaurant name to the breadcrumb navigation menu
*/
fillBreadcrumb = (restaurant=self.restaurant) => {
	const breadcrumb = document.getElementById('breadcrumb');
	var found = false;
	var children = breadcrumb.getElementsByTagName("li");
	for(var ii = 0; ii < children.length; ii++) {
		var curChild = children[ii];
		if(curChild.innerHTML.indexOf(restaurant.name) >= 0) {
			found = true;
			return;
		}
	}
	
	if(!found) {
		const li = document.createElement('li');
		li.innerHTML = restaurant.name;
		breadcrumb.appendChild(li);
	}
}

/**
* Clears the review input form
*/
clearReviewForm = () => {
	document.getElementById('user_name').value = "";
	document.getElementById('user_rating').value = "1";
	document.getElementById('user_comment').value = "";
}

/**
* Get a parameter by name from page URL.
*/
getParameterByName = (name, url) => {
	if (!url)
		url = window.location.href;
	name = name.replace(/[\[\]]/g, '\\$&');
	const regex = new RegExp(`[?&]${name}(=([^&#]*)|&|#|$)`),
	results = regex.exec(url);
	if (!results)
		return null;
	if (!results[2])
		return '';
	return decodeURIComponent(results[2].replace(/\+/g, ' '));
}
