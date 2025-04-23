mapboxgl.accessToken = 'pk.eyJ1Ijoia2FrYXJzdWhhaWwiLCJhIjoiY2tpaWxsa205MjhjbDJ5cGVhaWRkaWI1MCJ9.9wW7P75jPB9RE7xLfdZEaA';

// Global variables for tracking
let currentPosition = null;
let lastPosition = null;
let lastSpeedUpdate = Date.now();
let isHUDMode = false;
let isDarkMode = true;
let isVoiceEnabled = false;
let isTrafficEnabled = false;
let currentRoute = null;
let speechSynthesis = window.speechSynthesis;

// Map style configurations
const mapStyles = {
	day: {
		normal: 'mapbox://styles/mapbox/streets-v11',
		navigation: 'mapbox://styles/mapbox/navigation-day-v1',
		satellite: 'mapbox://styles/mapbox/satellite-v9'
	},
	night: {
		normal: 'mapbox://styles/mapbox/dark-v11',
		navigation: 'mapbox://styles/mapbox/navigation-night-v1',
		satellite: 'mapbox://styles/mapbox/satellite-v9'
	}
};

// Initialize map with user's location
navigator.geolocation.getCurrentPosition(successLocation, errorLocation, {
	enableHighAccuracy: true
});

// Attempt to enter fullscreen on page load
window.addEventListener('DOMContentLoaded', () => {
    function requestFullscreen() {
        const el = document.documentElement;
        if (el.requestFullscreen) {
            el.requestFullscreen();
        } else if (el.webkitRequestFullscreen) {
            el.webkitRequestFullscreen();
        } else if (el.msRequestFullscreen) {
            el.msRequestFullscreen();
        }
    }
    // Try automatically
    requestFullscreen();
    // If not in fullscreen after 1s, show prompt
    setTimeout(() => {
        if (!document.fullscreenElement) {
            alert('Tap the fullscreen button for an immersive experience!');
        }
    }, 1000);
});

function successLocation(position) {
	setupMap([position.coords.longitude, position.coords.latitude]);
	startPositionTracking();
}

function errorLocation() {
	setupMap([-2.24, 53.48]);
}

function setupMap(center) {
	const map = new mapboxgl.Map({
		container: 'map',
		style: mapStyles.night.normal,
		center: center,
		zoom: 15
	})
	const nav = new mapboxgl.NavigationControl();
	map.addControl(nav, "bottom-left")
	const directions = new MapboxDirections({
		accessToken: mapboxgl.accessToken,
		unit: 'metric',
		profile: 'mapbox/driving',
		alternatives: true,
		congestion: true,
		language: 'en'
	})
	map.addControl(directions, "top-left")

	// Setup HUD mode and theme toggle
	setupHUDMode(map, directions);
	setupThemeToggle(map);
	setupVoiceNavigation();
	setupTrafficLayer(map);
	setupMapTypeControls(map);
setupFullscreenToggle();
}

function setupThemeToggle(map) {
	const themeToggle = document.getElementById('theme-toggle');
	
	themeToggle.addEventListener('click', () => {
		isDarkMode = !isDarkMode;
		themeToggle.classList.toggle('active', isDarkMode);
		updateMapStyle(map);
	});
}

function setupHUDMode(map, directions) {
	const hudContainer = document.getElementById('hud-container');
	const hudToggle = document.getElementById('hud-toggle');
	const hudOverlay = document.querySelector('.hud-overlay');
	const destinationModal = document.getElementById('destination-modal');
	const mapContainer = document.body;

	// Toggle HUD mode
	hudToggle.addEventListener('click', () => {
		isHUDMode = !isHUDMode;
		hudContainer.classList.toggle('hud-hidden', !isHUDMode);
		hudOverlay.classList.toggle('active', isHUDMode);
		hudToggle.classList.toggle('active', isHUDMode);
		mapContainer.classList.toggle('hud-active', isHUDMode);
		updateMapStyle(map);
	});

	// Listen for route updates
	directions.on('route', (e) => {
		if (e.route && e.route[0]) {
			currentRoute = e.route[0];
			updateHUDInfo();
			
			// Highlight HUD button instead of auto-enabling
			hudToggle.classList.add('route-available');
		} else {
			// Remove highlight when route is cleared
			hudToggle.classList.remove('route-available');
			hudToggle.classList.remove('active');
			isHUDMode = false;
			hudContainer.classList.add('hud-hidden');
			hudOverlay.classList.remove('active');
			mapContainer.classList.remove('hud-active');
		}
	});

	// Listen for arrival
	map.on('moveend', () => {
		if (currentRoute && directions.getDestination()) {
			const dest = directions.getDestination().geometry.coordinates;
			const current = map.getCenter();
			
			// Check if we're within 50 meters of destination
			if (calculateDistance(current, dest) < 0.05) {
				destinationModal.classList.remove('hidden');
				setTimeout(() => {
					destinationModal.classList.add('hidden');
					// Reset HUD mode when destination is reached
					if (isHUDMode) {
						hudToggle.click();
					}
					hudToggle.classList.remove('route-available');
				}, 3000);
			}
		}
	});
}

function setupVoiceNavigation() {
	const voiceToggle = document.getElementById('voice-toggle');
	
	voiceToggle.addEventListener('click', () => {
		isVoiceEnabled = !isVoiceEnabled;
		voiceToggle.classList.toggle('active', isVoiceEnabled);
		
		if (isVoiceEnabled) {
			// Request microphone permission
			navigator.mediaDevices.getUserMedia({ audio: true })
				.then(() => {
					console.log('Voice navigation enabled');
				})
				.catch(err => {
					console.error('Error accessing microphone:', err);
					isVoiceEnabled = false;
					voiceToggle.classList.remove('active');
				});
		}
	});
}

function setupTrafficLayer(map) {
	const trafficToggle = document.getElementById('traffic-toggle');
	
	// Add traffic layer when map style is loaded
	map.on('style.load', () => {
		map.addSource('traffic', {
			type: 'vector',
			url: 'mapbox://mapbox.mapbox-traffic-v1'
		});
		
		map.addLayer({
			id: 'traffic',
			type: 'line',
			source: 'traffic',
			'source-layer': 'traffic',
			paint: {
				'line-color': [
					'case',
					['==', ['get', 'congestion'], 'low'],
					'#4CAF50',
					['==', ['get', 'congestion'], 'moderate'],
					'#FFC107',
					'#F44336'
				],
				'line-width': 4,
				'line-opacity': 0.7
			},
			layout: {
				'visibility': 'none'
			}
		});
	});
	
	trafficToggle.addEventListener('click', () => {
		isTrafficEnabled = !isTrafficEnabled;
		trafficToggle.classList.toggle('active', isTrafficEnabled);
		
		if (isTrafficEnabled) {
			map.setLayoutProperty('traffic', 'visibility', 'visible');
		} else {
			map.setLayoutProperty('traffic', 'visibility', 'none');
		}
	});
}

function setupFullscreenToggle() {
    const fullscreenToggle = document.getElementById('fullscreen-toggle');
    let isFullscreen = false;

    fullscreenToggle.addEventListener('click', () => {
        if (!isFullscreen) {
            if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen();
            } else if (document.documentElement.webkitRequestFullscreen) {
                document.documentElement.webkitRequestFullscreen();
            } else if (document.documentElement.msRequestFullscreen) {
                document.documentElement.msRequestFullscreen();
            }
            fullscreenToggle.querySelector('.material-icons').textContent = 'fullscreen_exit';
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
            fullscreenToggle.querySelector('.material-icons').textContent = 'fullscreen';
        }
        isFullscreen = !isFullscreen;
    });

    // Listen for fullscreen change (in case user presses ESC or uses browser controls)
    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
            isFullscreen = false;
            fullscreenToggle.querySelector('.material-icons').textContent = 'fullscreen';
        }
    });
}

function setupMapTypeControls(map) {
	const mapTypeToggle = document.getElementById('map-type-toggle');
	const satelliteToggle = document.getElementById('satellite-toggle');
	let isSatellite = false;

	mapTypeToggle.addEventListener('click', () => {
		isSatellite = false;
		updateMapStyle(map);
		mapTypeToggle.classList.add('active');
		satelliteToggle.classList.remove('active');
	});

	satelliteToggle.addEventListener('click', () => {
		isSatellite = true;
		updateMapStyle(map);
		satelliteToggle.classList.add('active');
		mapTypeToggle.classList.remove('active');
	});
}

function updateMapStyle(map) {
	const style = isHUDMode ? 
		(isDarkMode ? mapStyles.night.navigation : mapStyles.day.navigation) :
		(isSatellite ? mapStyles.day.satellite :
			(isDarkMode ? mapStyles.night.normal : mapStyles.day.normal));
	
	map.setStyle(style);
}

function startPositionTracking() {
	navigator.geolocation.watchPosition(
		(position) => {
			lastPosition = currentPosition;
			currentPosition = position;
			updateHUDInfo();
		},
		null,
		{ enableHighAccuracy: true }
	);
}

// For animated speed
let displayedSpeed = 0;

function updateHUDInfo() {
    if (!isHUDMode) return;

    // Update speed smoothly
    let targetSpeed = 0;
    if (currentPosition && lastPosition) {
        targetSpeed = calculateSpeed(currentPosition, lastPosition);
    }
    // Animate speed towards targetSpeed
    displayedSpeed += (targetSpeed - displayedSpeed) * 0.15; // animation factor
    if (Math.abs(displayedSpeed - targetSpeed) < 0.5) displayedSpeed = targetSpeed;
    document.querySelector('.speed .value').textContent = Math.round(displayedSpeed);

    // Update ETA and color
    if (currentRoute) {
        const eta = Math.round(currentRoute.duration / 60);
        const etaElem = document.querySelector('.time .value');
        etaElem.textContent = eta;
        // Color logic: green <15, orange 15-30, red >30
        if (eta < 15) {
            etaElem.style.color = '#4CAF50';
        } else if (eta < 30) {
            etaElem.style.color = '#FFC107';
        } else {
            etaElem.style.color = '#F44336';
        }
    }

    // Update direction arrow
    if (currentRoute && currentRoute.legs[0]) {
        const nextManeuver = currentRoute.legs[0].steps[0];
        const angle = calculateBearing(nextManeuver.maneuver.location);
        document.querySelector('.direction-icon').style.transform = `rotate(${angle}deg)`;
    }
}

// Animate speed every frame for smoothness
function animateHUD() {
    updateHUDInfo();
    requestAnimationFrame(animateHUD);
}

// Start animation loop
animateHUD();

function calculateSpeed(current, last) {
	const timeDiff = (current.timestamp - last.timestamp) / 1000; // seconds
	const distance = calculateDistance(
		[last.coords.longitude, last.coords.latitude],
		[current.coords.longitude, current.coords.latitude]
	);
	return (distance / timeDiff) * 3600; // Convert to km/h
}

function calculateDistance(point1, point2) {
	const lon1 = point1[0] * Math.PI / 180;
	const lon2 = point2[0] * Math.PI / 180;
	const lat1 = point1[1] * Math.PI / 180;
	const lat2 = point2[1] * Math.PI / 180;

	const dlon = lon2 - lon1;
	const dlat = lat2 - lat1;
	const a = Math.sin(dlat/2)**2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dlon/2)**2;
	const c = 2 * Math.asin(Math.sqrt(a));
	return 6371 * c; // Radius of earth in kilometers
}

function calculateBearing(point) {
	if (!currentPosition) return 0;
	
	const lon1 = currentPosition.coords.longitude * Math.PI / 180;
	const lon2 = point[0] * Math.PI / 180;
	const lat1 = currentPosition.coords.latitude * Math.PI / 180;
	const lat2 = point[1] * Math.PI / 180;

	const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
	const x = Math.cos(lat1) * Math.sin(lat2) -
			Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
	const bearing = Math.atan2(y, x) * 180 / Math.PI;
	return (bearing + 360) % 360;
}

function updateNavigationInfo(step) {
	const navInfo = document.getElementById('nav-info');
	const turnIcon = document.querySelector('.turn-icon');
	const turnInstruction = document.querySelector('.turn-instruction');
	const turnDistance = document.querySelector('.turn-distance');
	const lanesContainer = document.querySelector('.lanes');
	const trafficStatus = document.querySelector('.traffic-status');

	// Update turn information
	turnInstruction.textContent = step.maneuver.instruction;
	turnDistance.textContent = `in ${Math.round(step.distance)}m`;
	
	// Update turn icon based on maneuver type
	const icon = getManeuverIcon(step.maneuver.type);
	turnIcon.innerHTML = `<span class="material-icons">${icon}</span>`;

	// Update lane guidance
	if (step.intersections && step.intersections[0].lanes) {
		lanesContainer.innerHTML = '';
		step.intersections[0].lanes.forEach(lane => {
			const laneElement = document.createElement('div');
			laneElement.className = `lane ${lane.active ? 'active' : ''}`;
			laneElement.innerHTML = `<span class="material-icons lane-arrow">${getLaneArrow(lane.indications)}</span>`;
			lanesContainer.appendChild(laneElement);
		});
	}

	// Update traffic information
	if (step.traffic) {
		const trafficLevel = getTrafficLevel(step.traffic);
		trafficStatus.textContent = trafficLevel;
		document.querySelector('.traffic-icon').style.backgroundColor = getTrafficColor(trafficLevel);
	}

	// Show navigation info
	navInfo.classList.remove('nav-info-hidden');

	// Speak turn instruction if voice is enabled
	if (isVoiceEnabled) {
		speakTurnInstruction(step);
	}
}

function getManeuverIcon(type) {
	const icons = {
		'turn': 'turn_right',
		'merge': 'call_merge',
		'depart': 'navigation',
		'arrive': 'flag',
		'fork': 'fork_right',
		'roundabout': 'roundabout_right'
	};
	return icons[type] || 'navigation';
}

function getLaneArrow(indications) {
	if (indications.includes('straight')) return 'straight';
	if (indications.includes('right')) return 'arrow_right';
	if (indications.includes('left')) return 'arrow_left';
	return 'navigation';
}

function getTrafficLevel(traffic) {
	if (traffic < 0.3) return 'Light traffic';
	if (traffic < 0.7) return 'Moderate traffic';
	return 'Heavy traffic';
}

function getTrafficColor(level) {
	const colors = {
		'Light traffic': '#4CAF50',
		'Moderate traffic': '#FFC107',
		'Heavy traffic': '#F44336'
	};
	return colors[level] || '#FFC107';
}

function speakTurnInstruction(step) {
	const utterance = new SpeechSynthesisUtterance(step.maneuver.instruction);
	utterance.rate = 1.0;
	utterance.pitch = 1.0;
	speechSynthesis.speak(utterance);
}