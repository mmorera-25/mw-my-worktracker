import MeetingNotes from "../../features/notes/MeetingNotes";
import SimplePage from "./SimplePage";

type NotesPageProps = {
  lanes: string[];
  swimlanes: string[];
};

const NotesPage = ({ lanes, swimlanes }: NotesPageProps) => {
  return (
    <SimplePage title="Notes">
      <MeetingNotes lanes={lanes} swimlanes={swimlanes} />
    </SimplePage>
  );
};

export default NotesPage;
