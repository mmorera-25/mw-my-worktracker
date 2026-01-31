import OneOnOneFeed from "../../features/oneonone/OneOnOneFeed";
import SimplePage from "./SimplePage";

type MeetingsPageProps = {
  userFirstName: string;
};

const MeetingsPage = ({ userFirstName }: MeetingsPageProps) => {
  return (
    <SimplePage title="Meetings">
      <OneOnOneFeed userFirstName={userFirstName} />
    </SimplePage>
  );
};

export default MeetingsPage;
