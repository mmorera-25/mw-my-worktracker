import type { User } from 'firebase/auth'
import InboxDreamsShell from '../../inbox-dreams/InboxDreamsShell'

type MainShellProps = {
  user: User
}

const MainShell = ({ user }: MainShellProps) => {
  return <InboxDreamsShell user={user} />
}

export default MainShell
