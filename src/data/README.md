# Location suggestions data

`world-cities.json` is a compact, browser-searchable derivative of the city records distributed by `city-timezones` 1.3.4 (MIT). It includes populated urban locations with source population estimates of 50,000 or more and retains city name, country, ISO-2 country code, region, and population; time-zone and coordinate fields are omitted. The component lazy-loads this file when a location field is focused. The country selector is sourced separately from `country-list` and includes 249 country/territory names.

The city data is a broad global reference, not a live geocoder or an exhaustive address database. A custom-location option remains available for places outside the supplied city list.
