import type { RenshuuContext } from "../RenshuuApp";
import type { Route } from "../router";
import { UserCard } from "./UserCard";
import { Streak } from "./Streak";
import { DailyChallenges } from "./DailyChallenges";
import { MasterySchedules } from "./MasterySchedules";
import { BeginnerHelp } from "./BeginnerHelp";

interface Props {
  ctx: RenshuuContext;
  navigate: (r: Route) => void;
  userName: string;
}

export function Dashboard({ ctx, navigate, userName }: Props) {
  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening";
  return (
    <div className="rs-dashboard">
      <h1 className="rs-dashboard-greet">{greeting}, {userName}</h1>
      <div className="rs-dashboard-grid">
        <div className="rs-dashboard-col">
          <UserCard ctx={ctx} userName={userName} />
          <MasterySchedules ctx={ctx} navigate={navigate} />
          <BeginnerHelp navigate={navigate} />
        </div>
        <div className="rs-dashboard-col">
          <Streak ctx={ctx} />
          <DailyChallenges ctx={ctx} />
        </div>
      </div>
    </div>
  );
}
