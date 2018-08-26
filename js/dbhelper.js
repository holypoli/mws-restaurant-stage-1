/**
 * Common database helper functions.
 */
class DBHelper {
  /**
   * Database URL.
   * Change this to restaurants.json file location on your server.
   */
  static get DATABASE_URL() {
    const port = 1337; // Change this to your server port
    return `http://localhost:${port}/restaurants`;
  }

  /**
   * Create new IndexDB
   */
  static openDb() {
    const dbPromise = idb.open("restaurant-db", 1, upgradeDb => {
      let restaurantStore = upgradeDb.createObjectStore("restaurants", {
        keyPath: "id"
      });
    });

    return dbPromise;
  }

  /**
   * Fetch all restaurants.
   */
  static fetchRestaurants() {
    fetch(this.DATABASE_URL)
      .then(response => {
        return response.json();
      })
      .then(data => {
        this.addRestaurants(data);
      })
      .catch(err => {
        console.log(err);
      });
  }

  static fetchRestaurantsOffline() {
    return this.openDb()
      .then(db => {
        let tx = db.transaction("restaurants", "readwrite");
        let store = tx.objectStore("restaurants");
        return store.getAll();
      })
      .then(restaurants => {
        if (!restaurants || restaurants.length === 0) {
          this.fetchRestaurants().then(restaurants => {
            return restaurants;
          });
        } else return restaurants;
      });
  }

  static addRestaurants(restaurants) {
    return this.openDb()
      .then(db => {
        let tx = db.transaction("restaurants", "readwrite");
        let store = tx.objectStore("restaurants");
        return Promise.all(
          restaurants.map(restaurant => {
            return store.put(restaurant);
          })
        ).catch(err => {
          tx.abort();
          console.log(err);
        });
      })
      .catch(err => console.log(err));
  }

  static fetchRestaurantByIdOffline(id) {
    return this.openDb()
      .then(db => {
        let tx = db.transaction("restaurants", "readonly");
        let store = tx.objectStore("restaurants");
        return store.get(parseInt(id));
      })
      .then(restaurant => {
        console.log(restaurant);
        if (!restaurant) return this.fetchRestaurantById(id);
        return restaurant;
      });
  }

  /**
   * Fetch a restaurant by its ID.
   */
  static fetchRestaurantById(id) {
    // fetch all restaurants with proper error handling.
    fetch(this.DATABASE_URL + `/${id}`)
      .then(response => {
        return response.json();
      })
      .catch(err => {
        console.log(err);
      });
  }

  /**
   * Fetch restaurants by a cuisine type with proper error handling.
   */
  static fetchRestaurantByCuisine(cuisine, callback) {
    // Fetch all restaurants  with proper error handling
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        console.log(error);
      } else {
        // Filter restaurants to have only given cuisine type
        const results = restaurants.filter(r => r.cuisine_type == cuisine);
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
  static fetchRestaurantByCuisineAndNeighborhood(
    cuisine,
    neighborhood,
    callback
  ) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        let results = restaurants;
        if (cuisine != "all") {
          // filter by cuisine
          results = results.filter(r => r.cuisine_type == cuisine);
        }
        if (neighborhood != "all") {
          // filter by neighborhood
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
        const neighborhoods = restaurants.map(
          (v, i) => restaurants[i].neighborhood
        );
        // Remove duplicates from neighborhoods
        const uniqueNeighborhoods = neighborhoods.filter(
          (v, i) => neighborhoods.indexOf(v) == i
        );
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
        const cuisines = restaurants.map((v, i) => restaurants[i].cuisine_type);
        // Remove duplicates from cuisines
        const uniqueCuisines = cuisines.filter(
          (v, i) => cuisines.indexOf(v) == i
        );
        callback(null, uniqueCuisines);
      }
    });
  }

  /**
   * Restaurant page URL.
   */
  static urlForRestaurant(restaurant) {
    return `./restaurant.html?id=${restaurant.id}`;
  }

  /**
   * Restaurant image URL.
   */
  static imageUrlForRestaurantSmall(restaurant) {
    return `/responsive-img/${restaurant.id}-200-small-1x.jpg 200w
     /responsive-img/${restaurant.id}-400-small-2x.jpg 400w`;
  }

  static imageSrcForRestaurant(restaurant) {
    return `/responsive-img/${restaurant.id}-400-medium-1x.jpg`;
  }

  static imageUrlForRestaurant(restaurant) {
    return `/responsive-img/${restaurant.id}-800-large-1x.jpg 800w,
    /responsive-img/${restaurant.id}-400-medium-1x.jpg 400w,
    /responsive-img/${restaurant.id}-200-small-1x.jpg 200w
    `;
  }

  /**
   * Map marker for a restaurant.
   */
  static mapMarkerForRestaurant(restaurant, map) {
    const marker = new google.maps.Marker({
      position: restaurant.latlng,
      title: restaurant.name,
      url: DBHelper.urlForRestaurant(restaurant),
      map: map,
      animation: google.maps.Animation.DROP
    });
    return marker;
  }
}
