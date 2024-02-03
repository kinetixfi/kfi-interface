import React from "react";

import "./Footer.css";

import Blog from "./assets/social/Blog";
import Discord from "./assets/social/Discord";
import GitBook from "./assets/social/GitBook";
import GitHub from "./assets/social/Github";
import Medium from "./assets/social/Medium";
import Telegram from "./assets/social/Telegram";
import X from "./assets/social/X";
const linkList = [
  { link: "https://twitter.com/KinetixFi", icon: <X /> },
  { link: "https://discord.gg/29qqtpFF9F", icon: <Discord /> },
  { link: "https://t.me/KinetixFi", icon: <Telegram /> },
  { link: "https://docs.kinetix.finance", icon: <GitBook /> },
  { link: "https://github.com/kinetixfi", icon: <GitHub /> },
  { link: "https://medium.com/@kinetixfi", icon: <Medium /> },
  { link: "", icon: <Blog /> },
]

export default function Footer() {
  // const [lastSubgraphBlock] = useLastSubgraphBlock();
  // const [lastBlock] = useLastBlock();
  return (
    <div
      className='k-footer'
      >
      <span className='k-footer-text '>© 2023 Kinetix Finance.</span>
      <div className='k-footer-links'>
        {linkList.map((item, index) => <a key={index} href={item.link} target='_blank' >{item.icon}</a>)}
      </div>
    </div>
  )
}
