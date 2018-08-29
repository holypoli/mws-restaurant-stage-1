let restaurant;
var map;

/*
 * Register Service Worker
*/
registerServiceWorker = () => {
  if (navigator.serviceWorker) {
    navigator.serviceWorker.register("sw.js").then(
      reg => {
        console.log("Service Worker registerd scope is: " + reg.scope);
      },
      err => {
        console.log("OH NOOO!!!", err);
      }
    );
  }
};

/**
 * Initialize Google map, called from HTML.
 */
window.initMap = () => {
  const id = getParameterByName("id");
  if (!id) {
    console.error("No Id in the URL");
    return;
  } else {
    DBHelper.fetchRestaurantByIdOffline(id).then(restaurant => {
      self.restaurant = restaurant;

      fillRestaurantHTML();

      self.map = new google.maps.Map(document.getElementById("map"), {
        zoom: 16,
        center: restaurant.latlng,
        scrollwheel: false
      });

      const form = document.getElementById("review-form");

      enableReviewForm(form);
      enableCloseReviewForm(form);
      registerServiceWorker();
      fillBreadcrumb();

      DBHelper.mapMarkerForRestaurant(self.restaurant, self.map);
    });
  }
};

/**
 * Create restaurant HTML and add it to the webpage
 */
fillRestaurantHTML = (restaurant = self.restaurant) => {
  const name = document.getElementById("restaurant-name");
  name.innerHTML = restaurant.name;

  const address = document.getElementById("restaurant-address");
  address.innerHTML = restaurant.address;

  const image = document.getElementById("restaurant-img");
  image.className = "restaurant-img";
  image.src = DBHelper.imageSrcForRestaurant(restaurant);
  image.srcset = DBHelper.imageUrlForRestaurant(restaurant);

  image.alt = `${restaurant.name},
   ${restaurant.neighborhood}`;

  const cuisine = document.getElementById("restaurant-cuisine");
  cuisine.innerHTML = restaurant.cuisine_type;

  // fill operating hours
  if (restaurant.operating_hours) {
    fillRestaurantHoursHTML();
  }
  // fill reviews
  fillReviewsHTML();
};

/**
 * Create restaurant operating hours HTML table and add it to the webpage.
 */
fillRestaurantHoursHTML = (
  operatingHours = self.restaurant.operating_hours
) => {
  const hours = document.getElementById("restaurant-hours");
  for (let key in operatingHours) {
    const row = document.createElement("tr");

    const day = document.createElement("td");
    day.innerHTML = key;
    row.appendChild(day);

    const time = document.createElement("td");
    time.innerHTML = operatingHours[key];
    row.appendChild(time);

    hours.appendChild(row);
  }
};

/**
 * Create all reviews HTML and add them to the webpage.
 */
fillReviewsHTML = () => {
  const container = document.getElementById("reviews-container");

  DBHelper.fetchRestaurantReviews(self.restaurant.id).then(reviews => {
    if (!reviews) {
      const noReviews = document.createElement("p");
      noReviews.innerHTML = "No reviews yet!";
      container.appendChild(noReviews);
      return;
    }
    const ul = document.getElementById("reviews-list");
    ul.innerHTML = "";
    reviews.forEach(review => {
      ul.appendChild(createReviewHTML(review));
    });
    container.appendChild(ul);
  });
};

/**
 * Create review HTML and add it to the webpage.
 */
createReviewHTML = review => {
  const li = document.createElement("li");
  const liHeader = document.createElement("div");
  liHeader.className = "review-header";
  li.appendChild(liHeader);

  const name = document.createElement("p");
  name.className = "name";
  name.innerHTML = review.name;
  liHeader.appendChild(name);

  const date = document.createElement("p");
  const writtenAt = new Date(review.updatedAt).toDateString().split(" ");
  date.className = "date";
  date.innerHTML = writtenAt[2] + ". " + writtenAt[1] + ", " + writtenAt[3];
  liHeader.appendChild(date);

  const rating = document.createElement("p");
  rating.className = "rating";
  rating.innerHTML = `Rating: ${review.rating}`;
  li.appendChild(rating);

  const comments = document.createElement("p");
  comments.className = "comments";
  comments.innerHTML = review.comments;
  li.appendChild(comments);

  const submitButton = document.getElementById("submit-review");
  submitButton.onclick = submitForm;

  return li;
};

submitForm = () => {
  const review = new FormData();
  const form = document.getElementById("review-form");

  review.append("restaurant_id", self.restaurant.id);

  let nameInput = document.getElementById("name");
  let name = nameInput.value;

  if (!name) return;
  review.append("name", name);

  let ratingInput = document.getElementById("rating");
  let commentsInput = document.getElementById("comment");
  let successMessage = document.querySelector(".success-message");
  let offlineMessage = document.querySelector(".offline-message");

  let rating = ratingInput.value;
  let comments = commentsInput.value;

  review.append("rating", rating);
  if (!rating) return;
  review.append("comments", comments);

  if (navigator.onLine) {
    DBHelper.addRestaurantReview(review).then(() => {
      nameInput.value = "";
      ratingInput.value = 0;
      commentsInput.value = "";
      form.style.display = "none";
      fillReviewsHTML();
      successMessage.style.display = "block";
      setTimeout(() => {
        successMessage.style.display = "none";
      }, 2000);
    });
  } else {
    let reviewData = {
      restaurant_id: self.restaurant.id,
      name: name,
      rating: rating,
      comments: comments,
      createdAt: Date.now()
    };
    return DBHelper.openDb()
      .then(db => {
        const tx = db.transaction("reviews", "readwrite");
        const store = tx.objectStore("reviews");
        store.put(reviewData);
        return tx.complete;
      })
      .then(() => {
        nameInput.value = "";
        ratingInput.value = 0;
        commentsInput.value = "";
        form.style.display = "none";
        offlineMessage.style.display = "block";
        setTimeout(() => {
          offlineMessage.style.display = "none";
        }, 4000);
      });
  }
};

/**
 * Add restaurant name to the breadcrumb navigation menu
 */
fillBreadcrumb = (restaurant = self.restaurant) => {
  const breadcrumb = document.getElementById("breadcrumb");
  const li = document.createElement("li");
  li.innerHTML = restaurant.name;
  breadcrumb.appendChild(li);
};

/*
 * Create page if there is no id
 */
createEmptyPage = () => {
  const textarea = document.getElementById("restaurant-container");
  const text = document.createElement("p");
  const cuisineBox = document.getElementById("restaurant-cuisine");
  cuisineBox.hidden = "true";
  text.innerHTML = "This page doesn't exist!";
  text.style.marginLeft = "20px";
  text.style.marginRight = "20px";
  textarea.appendChild(text);
};

/**
 * Get a parameter by name from page URL.
 */
getParameterByName = (name, url) => {
  if (!url) url = window.location.href;
  name = name.replace(/[\[\]]/g, "\\$&");
  const regex = new RegExp(`[?&]${name}(=([^&#]*)|&|#|$)`),
    results = regex.exec(url);
  if (!results) return null;
  if (!results[2]) return "";
  return decodeURIComponent(results[2].replace(/\+/g, " "));
};

enableReviewForm = form => {
  const button = document.getElementById("review-btn");
  button.onclick = () => {
    form.style.display = "block";
  };
};

enableCloseReviewForm = form => {
  const close = document.querySelector(".modal-close");
  close.onclick = () => (form.style.display = "none");
};

window.addEventListener("online", () => {
  return DBHelper.openDb()
    .then(db => {
      let tx = db.transaction("reviews", "readonly");
      let store = tx.objectStore("reviews");
      return store.getAll();
    })
    .then(reviews => {
      if (reviews && reviews.length > 0) {
        return Promise.all(
          reviews.map(review => {
            const reviewData = new FormData();

            reviewData.append("restaurant_id", review.restaurant_id);
            reviewData.append("name", review.name);
            reviewData.append("rating", review.rating);
            reviewData.append("createdAt", review.createdAt);
            reviewData.append("comments", review.comments);

            return fetch(DBHelper.REVIEWS_URL, {
              method: "POST",
              body: reviewData
            })
              .then(response => {
                return response.json;
              })
              .then(data => {
                if (data) {
                  DBHelper.openDb()
                    .then(db => {
                      let tx = db.transaction("reviews", "readwrite");
                      let store = tx.objectStore("reviews");
                      return store.delete(review.id);
                    })
                    .then(fillReviewsHTML);
                }
              });
          })
        );
      }
    });
});
