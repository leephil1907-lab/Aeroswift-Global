import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { getCode, getNames } from 'country-list'
import { ChevronDown, LoaderCircle, MapPin } from 'lucide-react'
import './location-autocomplete.css'

const countryAliases = {
  'Bahamas (The)': 'The Bahamas',
  'Bolivia (Plurinational State of)': 'Bolivia',
  'Congo (the Democratic Republic of the)': 'Congo (Kinshasa)',
  'Congo (the)': 'Congo (Brazzaville)',
  'Iran (Islamic Republic of)': 'Iran',
  'Korea (the Democratic People\'s Republic of)': 'North Korea',
  'Korea (the Republic of)': 'South Korea',
  'Lao People\'s Democratic Republic (the)': 'Laos',
  'Moldova (the Republic of)': 'Moldova',
  'Netherlands (Kingdom of the)': 'Netherlands',
  'Russian Federation (the)': 'Russia',
  'Syrian Arab Republic (the)': 'Syria',
  'United Kingdom of Great Britain and Northern Ireland (the)': 'United Kingdom',
  'United States of America (the)': 'United States',
  'Venezuela (Bolivarian Republic of)': 'Venezuela',
}

const displayCountry = name => countryAliases[name] || name.replace(/\s+\(the\)$/i, '')
const flagFor = code => code && /^[A-Z]{2}$/i.test(code)
  ? String.fromCodePoint(...code.toUpperCase().split('').map(char => 127397 + char.charCodeAt(0)))
  : '🌐'
const normalize = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim()

const countries = getNames().map(sourceName => {
  const name = displayCountry(sourceName)
  const code = getCode(sourceName) || ''
  return {
    key: `country-${code || name}`,
    label: name,
    value: name,
    detail: 'Country or territory',
    kind: 'Country',
    flag: flagFor(code),
    search: normalize(`${name} ${sourceName} ${code}`),
    rank: 99_000,
  }
}).sort((a, b) => a.label.localeCompare(b.label))

const airports = [
  ['Lagos Murtala Muhammed', 'LOS', 'Lagos', 'Nigeria'], ['Abuja Nnamdi Azikiwe', 'ABV', 'Abuja', 'Nigeria'],
  ['Port Harcourt International', 'PHC', 'Port Harcourt', 'Nigeria'], ['Accra Kotoka', 'ACC', 'Accra', 'Ghana'],
  ['Nairobi Jomo Kenyatta', 'NBO', 'Nairobi', 'Kenya'], ['Johannesburg O. R. Tambo', 'JNB', 'Johannesburg', 'South Africa'],
  ['Cape Town International', 'CPT', 'Cape Town', 'South Africa'], ['Cairo International', 'CAI', 'Cairo', 'Egypt'],
  ['Addis Ababa Bole', 'ADD', 'Addis Ababa', 'Ethiopia'], ['Casablanca Mohammed V', 'CMN', 'Casablanca', 'Morocco'],
  ['London Heathrow', 'LHR', 'London', 'United Kingdom'], ['London Gatwick', 'LGW', 'London', 'United Kingdom'],
  ['Manchester Airport', 'MAN', 'Manchester', 'United Kingdom'], ['Paris Charles de Gaulle', 'CDG', 'Paris', 'France'],
  ['Amsterdam Schiphol', 'AMS', 'Amsterdam', 'Netherlands'], ['Frankfurt Airport', 'FRA', 'Frankfurt', 'Germany'],
  ['Madrid Barajas', 'MAD', 'Madrid', 'Spain'], ['Rome Fiumicino', 'FCO', 'Rome', 'Italy'],
  ['Istanbul Airport', 'IST', 'Istanbul', 'Türkiye'], ['Zurich Airport', 'ZRH', 'Zurich', 'Switzerland'],
  ['Dubai International', 'DXB', 'Dubai', 'United Arab Emirates'], ['Abu Dhabi Zayed International', 'AUH', 'Abu Dhabi', 'United Arab Emirates'],
  ['Doha Hamad International', 'DOH', 'Doha', 'Qatar'], ['Riyadh King Khalid', 'RUH', 'Riyadh', 'Saudi Arabia'],
  ['Mumbai Chhatrapati Shivaji Maharaj', 'BOM', 'Mumbai', 'India'], ['Delhi Indira Gandhi', 'DEL', 'Delhi', 'India'],
  ['Dhaka Hazrat Shahjalal', 'DAC', 'Dhaka', 'Bangladesh'], ['Karachi Jinnah International', 'KHI', 'Karachi', 'Pakistan'],
  ['Singapore Changi', 'SIN', 'Singapore', 'Singapore'], ['Hong Kong International', 'HKG', 'Hong Kong', 'Hong Kong'],
  ['Tokyo Haneda', 'HND', 'Tokyo', 'Japan'], ['Tokyo Narita', 'NRT', 'Tokyo', 'Japan'],
  ['Seoul Incheon', 'ICN', 'Seoul', 'South Korea'], ['Shanghai Pudong', 'PVG', 'Shanghai', 'China'],
  ['Beijing Capital', 'PEK', 'Beijing', 'China'], ['Bangkok Suvarnabhumi', 'BKK', 'Bangkok', 'Thailand'],
  ['Kuala Lumpur International', 'KUL', 'Kuala Lumpur', 'Malaysia'], ['Manila Ninoy Aquino', 'MNL', 'Manila', 'Philippines'],
  ['Sydney Kingsford Smith', 'SYD', 'Sydney', 'Australia'], ['Melbourne Airport', 'MEL', 'Melbourne', 'Australia'],
  ['Auckland Airport', 'AKL', 'Auckland', 'New Zealand'], ['Toronto Pearson', 'YYZ', 'Toronto', 'Canada'],
  ['Vancouver International', 'YVR', 'Vancouver', 'Canada'], ['New York John F. Kennedy', 'JFK', 'New York', 'United States'],
  ['New York Newark Liberty', 'EWR', 'Newark', 'United States'], ['Los Angeles International', 'LAX', 'Los Angeles', 'United States'],
  ['Chicago O’Hare', 'ORD', 'Chicago', 'United States'], ['Atlanta Hartsfield-Jackson', 'ATL', 'Atlanta', 'United States'],
  ['Mexico City International', 'MEX', 'Mexico City', 'Mexico'], ['São Paulo Guarulhos', 'GRU', 'São Paulo', 'Brazil'],
  ['Buenos Aires Ezeiza', 'EZE', 'Buenos Aires', 'Argentina'], ['Panama City Tocumen', 'PTY', 'Panama City', 'Panama'],
]

let cityOptionsPromise
function loadCityOptions() {
  if (!cityOptionsPromise) {
    cityOptionsPromise = import('./data/world-cities.json').then(module => {
      const seen = new Set()
      return module.default.map(item => {
        const country = displayCountry(item.country)
        const code = item.code || getCode(country) || ''
        const key = normalize(`${item.city}, ${country}`)
        return {
          key: `city-${key}`,
          label: `${item.city}, ${country}`,
          value: `${item.city}, ${country}`,
          detail: item.region ? `${item.region} · ${item.country}` : 'City or regional centre',
          kind: 'City',
          flag: flagFor(code),
          search: normalize(`${item.city} ${country} ${item.country} ${item.region} ${item.code}`),
          rank: Number(item.population) || 0,
        }
      }).filter(item => {
        if (seen.has(item.key)) return false
        seen.add(item.key)
        return true
      })
    }).catch(error => {
      cityOptionsPromise = undefined
      throw error
    })
  }
  return cityOptionsPromise
}

const airportOptions = airports.map(([airport, code, city, country]) => ({
  key: `airport-${code}`,
  label: `${airport} Airport (${code})`,
  value: `${airport} Airport (${code}), ${city}, ${country}`,
  detail: `${city}, ${country} · IATA ${code}`,
  kind: 'Airport',
  code,
  flag: '✈️',
  search: normalize(`${airport} ${code} ${city} ${country} airport`),
  rank: 100_000,
}))

export default function LocationAutocomplete({ id, name, label, value, onChange, placeholder = 'Search city, airport, or country', required = false, className = '' }) {
  const uid = useId().replace(/:/g, '')
  const inputId = id || `global-location-${uid}`
  const listId = `${inputId}-suggestions`
  const hintId = `${inputId}-hint`
  const blurTimer = useRef(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [cities, setCities] = useState([])
  const [loadError, setLoadError] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const query = normalize(value)

  useEffect(() => () => window.clearTimeout(blurTimer.current), [])

  const groups = useMemo(() => {
    if (!query) return [
      { label: `GLOBAL AIRPORTS · ${airportOptions.length}`, items: airportOptions },
      { label: 'GLOBAL CITIES', items: cities.slice(0, 12) },
      { label: `ALL COUNTRIES & TERRITORIES · ${countries.length}`, items: countries },
    ]
    const matches = [...airportOptions, ...cities, ...countries]
      .filter(option => option.search.includes(query))
      .sort((a, b) => {
        const score = option => option.kind === 'Airport' && normalize(option.code) === query ? -2 : option.search.startsWith(query) ? 0 : 1
        return score(a) - score(b) || b.rank - a.rank || a.label.localeCompare(b.label)
      })
      .slice(0, 12)
    if (matches.length && matches.some(option => normalize(option.value) === query)) {
      return [{ label: 'MATCHING LOCATIONS', items: matches }]
    }
    if (value.trim().length > 1) matches.push({
      key: `custom-${query}`,
      label: `Use “${value.trim()}” as entered`,
      value: value.trim(),
      detail: 'Keep your own city or location name',
      kind: 'Custom location',
      flag: '📍',
    })
    return [{ label: 'MATCHING LOCATIONS', items: matches }]
  }, [cities, query, value])
  const suggestions = useMemo(() => groups.flatMap(group => group.items), [groups])

  async function openSuggestions() {
    setOpen(true)
    if (cities.length || loading) return
    setLoading(true)
    setLoadError(false)
    try {
      setCities(await loadCityOptions())
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  function choose(option) {
    onChange(option.value)
    setOpen(false)
    setActiveIndex(-1)
  }

  function onKeyDown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!open) openSuggestions()
      setActiveIndex(index => Math.min(index + 1, suggestions.length - 1))
    } else if (event.key === 'ArrowUp' && open) {
      event.preventDefault()
      setActiveIndex(index => Math.max(index - 1, 0))
    } else if (event.key === 'Enter' && open && activeIndex >= 0 && suggestions[activeIndex]) {
      event.preventDefault()
      choose(suggestions[activeIndex])
    } else if (event.key === 'Escape') {
      setOpen(false)
      setActiveIndex(-1)
    }
  }

  let optionIndex = 0
  return <div className={`location-autocomplete ${className}`}>
    <label htmlFor={inputId}>{label}</label>
    <div className="location-input-shell">
      <MapPin className="location-input-icon" size={16} aria-hidden="true"/>
      <input
        id={inputId}
        name={name}
        type="text"
        role="combobox"
        value={value}
        onChange={event => { onChange(event.target.value); setOpen(true); setActiveIndex(-1); if (!cities.length) openSuggestions() }}
        onFocus={() => { window.clearTimeout(blurTimer.current); openSuggestions() }}
        onBlur={() => { blurTimer.current = window.setTimeout(() => setOpen(false), 120) }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck="false"
        required={required}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined}
        aria-describedby={hintId}
      />
      {loading ? <LoaderCircle className="location-input-chevron is-loading" size={16} aria-hidden="true"/> : <ChevronDown className={`location-input-chevron ${open ? 'is-open' : ''}`} size={16} aria-hidden="true"/>}
    </div>
    <span className="location-hint" id={hintId}>Choose a city, airport, or country—or enter any location.</span>
    {open && <div className="location-suggestions" id={listId} role="listbox" aria-label={`${label} suggestions`}>
      {!query && loading && <div className="location-loading"><LoaderCircle size={15} className="location-loading-icon"/> Loading the worldwide city list…</div>}
      {groups.map(group => <div className="location-suggestion-group" role="group" aria-label={group.label} key={group.label}>
        <div className="location-suggestion-heading" role="presentation">{group.label}</div>
        {group.items.map(option => {
          const index = optionIndex++
          return <button
            type="button"
            role="option"
            tabIndex={-1}
            id={`${listId}-option-${index}`}
            aria-selected={index === activeIndex}
            key={option.key}
            className={`location-suggestion ${index === activeIndex ? 'is-active' : ''}`}
            onMouseDown={event => event.preventDefault()}
            onClick={() => choose(option)}
          >
            <span className="location-option-flag" aria-hidden="true">{option.flag || <MapPin size={15}/>}</span>
            <span className="location-option-copy"><b>{option.label}</b><small>{option.detail}</small></span>
            <span className="location-option-kind">{option.kind}</span>
          </button>
        })}
      </div>)}
      {loadError && <div className="location-loading location-load-error">City suggestions are temporarily unavailable. You can still enter a location or choose a country.</div>}
      {query && !suggestions.length && <div className="location-loading">No exact match yet. You can keep typing your location.</div>}
    </div>}
  </div>
}
