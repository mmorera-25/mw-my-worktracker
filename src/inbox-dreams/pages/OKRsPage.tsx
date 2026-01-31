import OKRPage from "../../features/okrs/OKRPage";
import SimplePage from "./SimplePage";

type OKRsPageProps = {
  focusId: string | null;
};

const OKRsPage = ({ focusId }: OKRsPageProps) => {
  return (
    <SimplePage title="OKRs">
      <OKRPage focusId={focusId} />
    </SimplePage>
  );
};

export default OKRsPage;
