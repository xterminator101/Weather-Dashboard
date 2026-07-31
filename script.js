const form = document.getElementById('search-form');
const input = document.getElementById('city-input');
const statusEl = document.getElementById('status');
const card = document.getElementById('weather-card');
const cityNameEl = document.getElementById('city-name');
const temperatureEl = document.getElementById('temperature');
const conditionEl = document.getElementById('condition');
const windEl = document.getElementById('wind');
const forecastEl = document.getElementById('forecast');
const tempToggle = document.getElementById('temp-toggle');
const loadingSpinner = document.getElementById('loading-spinner');
const weatherIconEl = document.getElementById('weather-icon');
const suggestionsEl = document.getElementById('suggestions');
const submitButton = form.querySelector('button[type = "submit"]');

let currentUnit = 'F' // Default to Fahrenheit
let lastResults = null; // Store the last fetched weather data
let currentSuggestions = []; // List currently shown in the dropdown
let highlightedIndex = -1; // Suggestion that is highlighted
let latestQuery = '';

async function geocodeCity(city) {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error("Unable to contact the location service.");
    }

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
        throw new Error('City not found');
    }

    const { latitude, longitude, name, country } = data.results[0];
    return { latitude, longitude, name, country };
}

async function fetchCitySuggestions(query) {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5`;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error("Unable to load suggestions.");
    }

    const data = await response.json();
    return data.results || [];
}

async function runSearch(location) {
    card.classList.add('hidden');
    showStatus('');
    setLoading(true);
    submitButton.disabled = true;

    try {
        const { current, daily } = await fetchWeather(location.latitude, location.longitude);
        lastResults = { location, current, daily };
        renderWeather(); 
    } catch (error) {
        showStatus(error.message, true);
    } finally {
        setLoading(false);
        submitButton.disabled = false;
    }
}

async function fetchWeather(latitude, longitude) {
    const url = `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${latitude}&longitude=${longitude}` +
    `&current=temperature_2m,wind_speed_10m,weather_code` +
    `&daily=temperature_2m_max,temperature_2m_min,weather_code` +
    `&forecast_days=5&timezone=auto`;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error("Unable to retrieve weather data.");
    }

    const data = await response.json();

    if (!data.current || !data.daily) {
        throw new Error("Weather data unavailable.");
    }
    
    return { current: data.current, daily: data.daily };
}

function debounce(fn, delay) {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    };
}

function suggestionLabel(result) {
    return [result.name, result.admin1, result.country].filter(Boolean).join(', ');
}

function renderSuggestions(results) {
    currentSuggestions = results;
    highlightedIndex = -1;

    if (results.length === 0) {
        suggestionsEl.classList.add('hidden');
        suggestionsEl.innerHTML = '';
        return;
    }

    suggestionsEl.innerHTML = results.map((result, i) => `<li class = "suggestion" data-index = "${i}">${suggestionLabel(result)}</li>`).join('');
    suggestionsEl.classList.remove('hidden');
}

function hideSuggestions() {
    suggestionsEl.classList.add('hidden');
    suggestionsEl.innerHTML = '';
    currentSuggestions = [];
    highlightedIndex = -1;
}

function selectSuggestion(index) {
    const result = currentSuggestions[index];
    if (!result) return;

    input.value = suggestionLabel(result);
    hideSuggestions();
    runSearch(result);
}

function highlightSuggestion(index) {
    const items = suggestionsEl.querySelectorAll('.suggestion');
    items.forEach((item) => item.classList.remove('highlighted'));

    if(index >= 0 && index < items.length) {
        items[index].classList.add('highlighted');
        highlightedIndex = index;
    } else {
        highlightedIndex = -1;
    }
}

const debouncedFetchSuggestions = debounce(async (query) => {
    latestQuery = query;
    try {
        const results = await fetchCitySuggestions(query);
        if (query !== latestQuery) return;
        renderSuggestions(results);
    } catch {
        hideSuggestions();
    }
}, 300);

input.addEventListener('input', () => {
    const query = input.value.trim();
    if (query.length < 2) {
        hideSuggestions();
        return;
    }
    debouncedFetchSuggestions(query);
});

suggestionsEl.addEventListener('click', (event) => {
    const item = event.target.closest('.suggestion');
    if (!item) return;
    selectSuggestion(Number(item.dataset.index));
});

input.addEventListener('keydown', (event) => {
    if (currentSuggestions.length === 0) return;
 
    if (event.key === 'ArrowDown') {
        event.preventDefault();
        highlightSuggestion(Math.min(highlightedIndex + 1, currentSuggestions.length - 1));
    } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        highlightSuggestion(Math.max(highlightedIndex - 1, 0));
    } else if (event.key === 'Enter' && highlightedIndex >= 0) {
        event.preventDefault();
        selectSuggestion(highlightedIndex);
    } else if (event.key === 'Escape') {
        hideSuggestions();
    }
});

document.addEventListener('click', (event) => {
    if (!event.target.closest('.input-wrapper')) {
        hideSuggestions();
    }
});

function getWeatherIcon(code) {
    const iconMap = {
        0: 'day-sunny',
        1: 'day-sunny-overcast',
        2: 'day-cloudy',
        3: 'cloudy',
        45: 'day-fog', 48: 'day-fog',
        51: 'day-sprinkle', 53: 'day-sprinkle', 55: 'day-sprinkle',
        56: 'day-rain-mix', 57: 'day-rain-mix',
        61: 'day-rain', 63: 'day-rain', 65: 'day-rain',
        66: 'day-rain-mix', 67: 'day-rain-mix',
        71: 'day-snow', 73: 'day-snow', 75: 'day-snow', 77: 'day-snow',
        80: 'day-showers', 81: 'day-showers', 82: 'day-storm-showers',
        85: 'day-snow', 86: 'day-snow',
        95: 'day-thunderstorm', 96: 'day-hail', 99: 'day-hail',
    };
    const iconName = iconMap[code] ?? 'day-sunny-overcast';
    return `<i class = "wi wi-${iconName}"></i>`;
}


// Groups the 27 weather codes into 6 moods for background

function getWeatherMood(code) {
    if (code === 0 || code === 1) return 'clear';
    if (code === 2 || code === 3) return 'cloudy';
    if (code === 45 || code === 48) return 'fog';
    if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
    if ([95, 96, 99].includes(code)) return 'storm';
    return 'rain';
}

const moodThemes = {
    clear: { bg: '#241a0c', glow: '#e8a33d' },
    cloudy: { bg: '#171d33', glow: '#5fb4a2' },
    fog: { bg: '#1a1f2e', glow: '#8891b3' },
    rain: { bg: '#0f1830', glow: '#4a7bc4' },
    snow: { bg: '#182233', glow: '#a9d6ec' },
    storm: { bg: '#160f26', glow: '#8b5fc4' },
};

function applyMood(code) {
    const moodKey = getWeatherMood(code);
    const mood = moodThemes[moodKey];
    document.documentElement.style.setProperty('--mood-bg', mood.bg);
    document.documentElement.style.setProperty('--mood-glow', mood.glow);
    setBackgroundEffect(moodKey);
}

function describeWeatherCode(code) {
  const map = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Fog',
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    53: 'Drizzle',
    55: 'Dense drizzle',
    56: 'Light freezing drizzle',
    57: 'Dense freezing drizzle',
    61: 'Light rain',
    63: 'Rain',
    65: 'Heavy rain',
    66: 'Light freezing rain',
    67: 'Heavy freezing rain',
    71: 'Light snow',
    73: 'Snow',
    75: 'Heavy snow',
    77: 'Snow grains',
    80: 'Light rain showers',
    81: 'Rain showers',
    82: 'Violent rain showers',
    85: 'Light snow showers',
    86: 'Heavy snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with light hail',
    99: 'Thunderstorm with heavy hail',
  };
  return map[code] ?? `Unknown conditions (code ${code})`;
}

function celsiusToFahrenheit(celsius) {
    return (celsius * 9/5) + 32;
}

function formatTemp(celsius) {
    if (currentUnit === 'F') {
        return `${Math.round(celsiusToFahrenheit(celsius))}°F`;
    } else {
        return `${Math.round(celsius)}°C`;
    }
}

function showStatus(message, isError = false) {
    statusEl.textContent = message;
    statusEl.classList.toggle('error', isError)
}

function setLoading(isLoading) {
    loadingSpinner.classList.toggle('hidden', !isLoading);
}

function dayLabel(isoDate, index) {
    if (index === 0) return 'Today';
    const date = new Date(`${isoDate}T00:00:00`);
    return date.toLocaleDateString(undefined, { weekday: 'short'});
}

function renderForecast(daily) {
    forecastEl.innerHTML = '';

    daily.time.forEach((isoDate, i) => {
        const day = document.createElement('div');
        day.className = 'forecast-day';
        day.innerHTML = `
      <span class= "forecast-label">${dayLabel(isoDate, i)}</span>
      <span class= "forecast-icon">${getWeatherIcon(daily.weather_code[i])}</span>
      <span class= "forecast-condition">${describeWeatherCode(daily.weather_code[i])}</span>
      <span class= "forecast-temps">
      <span class= "forecast-high">${formatTemp(daily.temperature_2m_max[i])}</span>
      <span class= "forecast-low">${formatTemp(daily.temperature_2m_min[i])}</span>
      </span>
    `;

    forecastEl.appendChild(day);
    });
}

function renderWeather() {
    if (!lastResults) return;
    const { location, current, daily } = lastResults;

    cityNameEl.textContent = `${location.name}, ${location.country}`;
    weatherIconEl.innerHTML = getWeatherIcon(current.weather_code);
    temperatureEl.textContent = formatTemp(current.temperature_2m);
    conditionEl.textContent = describeWeatherCode(current.weather_code);
    windEl.textContent = `${Math.round(current.wind_speed_10m)} km/h`;
    card.classList.remove('hidden');

    showStatus('');

    applyMood(current.weather_code);

    renderForecast(daily);
}

form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const city = input.value.trim();
    if (!city) return;

    hideSuggestions();
    setLoading(true);
    submitButton.disabled = true;

    try {
        const location = await geocodeCity(city);
        await runSearch(location);
    } catch (error) {
        showStatus(error.message, true);
    } finally {
        setLoading(false);
        submitButton.disabled = false;
    }
});

tempToggle.addEventListener('click', (event) => {
    const button = event.target.closest('.temp-btn');
    if (!button) return;

    currentUnit = button.dataset.unit;

    tempToggle.querySelectorAll('.temp-btn').forEach((btn) => {
        btn.classList.toggle('active', btn === button);
    });

    renderWeather();
});

// Animated Background: tsParticles (MIT licensed)

let currentMoodKey = "cloudy";

const moodParticleOptions = {
    clear: {
        particles: {
            number: { value: 30 },
            color: { value: "#e8a33d" },
            shape: { type: "circle" },
            opacity: {
                value: { min: 0.2, max: 0.6 }
            },
            size: {
                value: { min: 1, max: 2.5 }
            },
            move: {
                enable: true,
                speed: 0.3,
                direction: "top",
                random: true
            }
        }
    },

    cloudy: {
        particles: {
            number: { value: 6 },
            color: { value: "#ffffff" },
            opacity: { value: 0.05 },
            size: {
                value: { min: 60, max: 120 }
            },
            move: {
                enable: true,
                speed: 0.15,
                direction: "right"
            }
        }
    },

    fog: {
        particles: {
            number: { value: 5 },
            color: { value: "#c8c8d2" },
            opacity: { value: 0.035 },
            size: {
                value: { min: 100, max: 200 }
            },
            move: {
                enable: true,
                speed: 0.2,
                direction: "right"
            }
        }
    },

    rain: {
        particles: {
            number: { value: 120 },
            color: { value: "#a9c6ef" },
            size: {
                value: 1.2
            },
            move: {
                enable: true,
                direction: "bottom",
                speed: 16,
                straight: true
            }
        }
    },

    snow: {
        particles: {
            number: { value: 80 },
            color: { value: "#ffffff" },
            size: {
                value: { min: 1.5, max: 3.5 }
            },
            move: {
                enable: true,
                direction: "bottom",
                speed: 1,
                random: true
            }
        }
    },

    storm: {
        particles: {
            number: { value: 150 },
            color: { value: "#9ab6e6" },
            size: {
                value: 1.5
            },
            move: {
                enable: true,
                direction: "bottom",
                speed: 22,
                straight: true
            }
        }
    }
};

async function setBackgroundEffect(moodKey) {
    currentMoodKey = moodKey;

    if (typeof loadAll === "function") {
        await loadAll(tsParticles);
    }

    await tsParticles.load({
        id: "tsparticles",

        options: {
            fullScreen: {
                enable: true,
                zIndex: 0
            },
            background: {
                color: "transparent"
            },
            fpsLimit: 60,
            detectRetina: true,
            particles: moodParticleOptions[moodKey].particles
        }
    });
}

setBackgroundEffect("cloudy");
const lightningEl = document.getElementById("lightning-flash");

function triggerLightning() {
    if (!lightningEl) return;
    lightningEl.style.transition = "none";
    lightningEl.style.opacity = "0.55";
    requestAnimationFrame(() => {

        lightningEl.style.transition = "opacity 0.6s ease-out";
        lightningEl.style.opacity = "0";

    });
}

function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

if (!prefersReducedMotion()) {
    setInterval(() => {
        if (currentMoodKey === "storm" && Math.random() < 0.08) {
            triggerLightning();
        }
    }, 400);
}
