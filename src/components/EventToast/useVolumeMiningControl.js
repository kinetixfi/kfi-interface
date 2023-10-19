import { useLocalStorage } from "react-use";
import toast from "react-hot-toast";
import eventsData from "../../config/events";
import { useEffect } from "react";
import EventToast from "./EventToast";
import { isFuture } from "date-fns";
import useWeb3Onboard from "../../hooks/useWeb3Onboard";
import { useIsAccountRegisteredOnVolumeMining }  from '../../Api' 

function useVolumeMiningControl() {
  const { library,chainId, account, active } = useWeb3Onboard();
  const [visited, setVisited] = useLocalStorage("token-distributor-visited"+account||"", false);
  const [isRegistered, setIsRegistered] = useIsAccountRegisteredOnVolumeMining(library, chainId, account)
  const event = {
      id: "token-distributor-activation",
      title: "Volume Mining",
      isActive: true,
      validTill: "01/01/2025 12:00:00 PM",
      bodyText: "Please go to leaderboard to register volume mining",
      buttons: [
        {
          text: "leaderboard.kinetix.finance",
          link: "https://leaderboard.kinetix.finance/account/" + account,
        }
      ],
    }

  useEffect(() => {
    console.log('!account || !active || visited || isRegistered', !account, !active , visited, isRegistered);
    if(isRegistered === undefined) return;
    if(!account || !active || visited || isRegistered) return
    toast.custom(
      (t) => (
        <EventToast
          event={event}
          id={event.id}
          t={t}
          onClick={() => {
            toast.dismiss(event.id);
            setVisited(true);
          }}
        />
      ),
      {
        id: event.id,
        style: {},
      }
    );
  }, [account, active, visited, setVisited, isRegistered]);
}

export default useVolumeMiningControl;
