//import { Geist, Geist_Mono } from "next/font/google";
import { GetStaticProps } from "next";
import Head from "next/head";
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  GoogleMap,
  LoadScript,
  Marker,
  InfoWindow,
} from "@react-google-maps/api";

// const geistSans = Geist({
//   variable: "--font-geist-sans",
//   subsets: ["latin"],
// });

// const geistMono = Geist_Mono({
//   variable: "--font-geist-mono",
//   subsets: ["latin"],
// });

interface Event {
  name: string;
  time: string;
  venue: string | string[];
  description?: string;
}

interface DaySchedule {
  date: string;
  dateRange?: string;
  events: Event[];
}

interface ScheduleData {
  eventName: string;
  tagline: string;
  schedule: DaySchedule[];
}

interface HomeProps {
  scheduleData: ScheduleData;
}

interface Location {
  lat: number;
  lng: number;
}

interface SelectedEvent extends Event {
  date: string;
  location?: Location;
}

interface VenueWithEvents extends Location {
  venueName: string;
  events: Array<{
    name: string;
    date: string;
    time: string;
  }>;
}

const CEBU_CENTER = {
  lat: 10.3157,
  lng: 123.8854,
};

const mapContainerStyle = {
  width: "100%",
  height: "100%",
};

// Add a utility function to check if a venue is TBA
const isTBA = (venue: string) => {
  const tbaPatterns = ["TBA", "to be announced", "Venue to be announced"];
  return tbaPatterns.some((pattern) =>
    venue.toLowerCase().includes(pattern.toLowerCase())
  );
};

// Add a utility function to get coordinates for a venue
const getVenueCoordinates = (venue: string): Location | null => {
  // Common venues in Cebu with their coordinates
  const venueMap: Record<string, Location> = {
    "SM Seaside Cebu": { lat: 10.2791, lng: 123.8585 },
    GMall: { lat: 10.3127, lng: 123.8854 },
    "Basilica del Sto. Nino": { lat: 10.2929, lng: 123.9021 },
    "Fuente Osmeña": { lat: 10.3116, lng: 123.8913 },
    "Plaza Independencia": { lat: 10.2925, lng: 123.9021 },
    "Cebu City Sports Complex": { lat: 10.3095, lng: 123.8862 },
    "MCIAA T1": { lat: 10.3075, lng: 123.9789 },
    "Ayala Center Cebu": { lat: 10.3187, lng: 123.9048 },
    "SM City Cebu": { lat: 10.3119, lng: 123.9178 },
    "Basilica Minore del Sto. Niño": { lat: 10.2929, lng: 123.9021 },
    "Mandaue City": { lat: 10.3231, lng: 123.9223 },
    SRP: { lat: 10.2674, lng: 123.8805 },
    "Pacific Grand Ballroom": { lat: 10.3142, lng: 123.9163 },
    // Add more venues as needed
  };

  // Try to find an exact match first
  if (venueMap[venue]) {
    return venueMap[venue];
  }

  // If no exact match, try to find a partial match
  const venueLower = venue.toLowerCase();
  for (const [key, coords] of Object.entries(venueMap)) {
    if (venueLower.includes(key.toLowerCase())) {
      return coords;
    }
  }

  return null;
};

export const getStaticProps: GetStaticProps<HomeProps> = async () => {
  const { default: scheduleData } = await import("../public/schedule.json");
  return {
    props: {
      scheduleData,
    },
  };
};

export default function Home({ scheduleData }: HomeProps) {
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [selectedEvent, setSelectedEvent] = useState<SelectedEvent | null>(
    null
  );
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [venues, setVenues] = useState<VenueWithEvents[]>([]);

  // Process venues and their events on component mount
  useEffect(() => {
    const venueMap = new Map<string, VenueWithEvents>();

    scheduleData.schedule.forEach((day) => {
      day.events.forEach((event) => {
        const venues = Array.isArray(event.venue) ? event.venue : [event.venue];

        venues.forEach((venue) => {
          if (!isTBA(venue)) {
            const coordinates = getVenueCoordinates(venue);
            if (coordinates) {
              if (!venueMap.has(venue)) {
                venueMap.set(venue, {
                  ...coordinates,
                  venueName: venue,
                  events: [],
                });
              }

              venueMap.get(venue)?.events.push({
                name: event.name,
                date: day.date,
                time: event.time,
              });
            }
          }
        });
      });
    });

    setVenues(Array.from(venueMap.values()));
  }, [scheduleData]);

  const onMapLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  const handleEventClick = (event: Event, date: string) => {
    const venue = Array.isArray(event.venue) ? event.venue[0] : event.venue;
    const location = getVenueCoordinates(venue);

    setSelectedEvent({ ...event, date, location });

    if (location && map) {
      map.panTo(location);
      map.setZoom(15);
    }
  };

  // Get unique venues for the location filter
  const uniqueVenues = useMemo(() => {
    const venues = new Set<string>();
    scheduleData.schedule.forEach((day) => {
      day.events.forEach((event) => {
        const eventVenues = Array.isArray(event.venue)
          ? event.venue
          : [event.venue];
        eventVenues.forEach((venue) => {
          if (!isTBA(venue) && getVenueCoordinates(venue)) {
            venues.add(venue);
          }
        });
      });
    });
    return Array.from(venues).sort();
  }, [scheduleData]);

  // Filter venues based on selected date and location
  const filteredVenues = useMemo(() => {
    let filtered = venues;

    if (selectedDate) {
      filtered = filtered
        .map((venue) => ({
          ...venue,
          events: venue.events.filter((event) => event.date === selectedDate),
        }))
        .filter((venue) => venue.events.length > 0);
    }

    if (selectedLocation) {
      filtered = filtered.filter(
        (venue) => venue.venueName === selectedLocation
      );
    }

    return filtered;
  }, [venues, selectedDate, selectedLocation]);

  // Group events by date for each venue
  const getVenueDates = (venue: VenueWithEvents) => {
    const dates = new Set(venue.events.map((event) => event.date));
    return Array.from(dates).sort();
  };

  return (
    <>
      <Head>
        <title>Sinulog 2025 Events</title>
      </Head>
      <div
        //className={`${geistSans.variable} ${geistMono.variable} h-screen flex flex-col`}
        className="h-screen flex flex-col"
      >
        <header className="text-center p-4 bg-white shadow-sm">
          <h1 className="text-2xl font-bold">{scheduleData.eventName}</h1>
          <p className="text-gray-600">{scheduleData.tagline}</p>
        </header>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-1/3 overflow-y-auto border-r">
            <div className="p-4">
              <select
                className="w-full p-2 border rounded mb-4"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              >
                <option value="">All Dates</option>
                {scheduleData.schedule.map((day) => (
                  <option key={day.date} value={day.date}>
                    {new Date(day.date).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </option>
                ))}
              </select>
              <select
                className="w-full p-2 border rounded mb-4"
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
              >
                <option value="">All Locations</option>
                {uniqueVenues.map((venue) => (
                  <option key={venue} value={venue}>
                    {venue}
                  </option>
                ))}
              </select>

              <div className="space-y-4">
                {scheduleData.schedule
                  .filter((day) => !selectedDate || day.date === selectedDate)
                  .map((day) => (
                    <div key={day.date} className="border rounded-lg p-4">
                      <h2 className="text-lg font-semibold mb-3">
                        {new Date(day.date).toLocaleDateString("en-US", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </h2>
                      <div className="space-y-2">
                        {day.events.map((event, index) => {
                          const venue = Array.isArray(event.venue)
                            ? event.venue[0]
                            : event.venue;

                          const isClickable =
                            !isTBA(venue) &&
                            !isTBA(event.time) &&
                            getVenueCoordinates(venue);

                          return (
                            <div
                              key={index}
                              className={`p-3 rounded ${
                                isClickable
                                  ? `cursor-pointer transition-colors ${
                                      selectedEvent?.name === event.name
                                        ? "bg-blue-50 border-blue-200"
                                        : "bg-gray-50 hover:bg-gray-100"
                                    }`
                                  : "bg-gray-50 opacity-75"
                              }`}
                              onClick={() =>
                                isClickable && handleEventClick(event, day.date)
                              }
                            >
                              <h3 className="font-medium">{event.name}</h3>
                              <p className="text-sm text-gray-600">
                                Time: {event.time}
                              </p>
                              <p className="text-sm text-gray-600">
                                Venue:{" "}
                                {Array.isArray(event.venue)
                                  ? event.venue.join(" & ")
                                  : event.venue}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          <div className="flex-1 relative">
            <LoadScript
              googleMapsApiKey={
                process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
                "AIzaSyCa0ALxq4q2PDyFh0iWG1rYz4D5zmgl2K8"
              }
            >
              <GoogleMap
                mapContainerStyle={mapContainerStyle}
                center={CEBU_CENTER}
                zoom={13}
                onLoad={onMapLoad}
              >
                {filteredVenues.map((venue) => (
                  <Marker
                    key={venue.venueName}
                    position={{ lat: venue.lat, lng: venue.lng }}
                    visible={
                      !selectedEvent || selectedEvent.venue === venue.venueName
                    }
                    onClick={() => {
                      if (map) {
                        map.panTo({ lat: venue.lat, lng: venue.lng });
                        map.setZoom(15);
                      }
                    }}
                  >
                    {(selectedLocation === venue.venueName ||
                      selectedEvent?.venue === venue.venueName) && (
                      <InfoWindow
                        position={{ lat: venue.lat, lng: venue.lng }}
                        onCloseClick={() => setSelectedEvent(null)}
                      >
                        <div className="p-2">
                          <h3 className="font-semibold">{venue.venueName}</h3>
                          <div className="mt-2 max-h-40 overflow-y-auto">
                            {getVenueDates(venue).map((date) => {
                              const dateEvents = venue.events.filter(
                                (event) => event.date === date
                              );
                              return (
                                <div key={date} className="mb-3">
                                  <p className="font-medium text-sm">
                                    {new Date(date).toLocaleDateString(
                                      "en-US",
                                      {
                                        weekday: "short",
                                        month: "short",
                                        day: "numeric",
                                      }
                                    )}
                                  </p>
                                  {dateEvents.map((event, index) => (
                                    <div key={index} className="ml-2 text-sm">
                                      <p className="text-gray-700">
                                        {event.name}
                                      </p>
                                      <p className="text-gray-600">
                                        Time: {event.time}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </InfoWindow>
                    )}
                  </Marker>
                ))}
              </GoogleMap>
            </LoadScript>
          </div>
        </div>
      </div>
    </>
  );
}
