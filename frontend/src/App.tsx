import { useEffect, useState } from "react";
import "./App.css";
import { fetchRoutePlan } from "./api/fetchBackendData";

type RoutePlan = {
  total_distance_m: number;
  waypoint_count: number;
  max_slope_encountered_deg: number;
  resolved_start: { x: number; y: number };
  resolved_end: { x: number; y: number };
};

function App() {
  const [route, setRoute] = useState<RoutePlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRoutePlan({ startX: 100, startY: 100, endX: 200, endY: 200 })
      .then(setRoute)
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) return <p>Error: {error}</p>;
  if (!route) return <p>Loading route…</p>;

  return (
    <main id="center">
      <h1>Route Plan</h1>
      <section className="data">
        <h2>
          Start: <span>({route.resolved_start.x}, {route.resolved_start.y})</span>
        </h2>
        <h2>
          End: <span>({route.resolved_end.x}, {route.resolved_end.y})</span>
        </h2>
        <h2>
          Distance: <span>{route.total_distance_m} m</span>
        </h2>
        <h2>
          Waypoints: <span>{route.waypoint_count}</span>
        </h2>
        <h2>
          Max slope: <span>{route.max_slope_encountered_deg}°</span>
        </h2>
      </section>
    </main>
  );
}

export default App;
