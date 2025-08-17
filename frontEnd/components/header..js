import chatClient from "../utils/chatClient";
import Link from 'next/link';

export default({req, currentUser})=>{
    const userLinks = [
        !currentUser && {label: "Sign Up", href: '/auth/signup'},
        !currentUser && {label: "Sign In", href: '/auth/signin'},
        currentUser  && {label: "Sign Out", href: '/auth/signout'}
    ]
    .filter(linkCondition=>linkCondition)
    .map(({label, href})=>{
        return <li key={href} className="nav-item">
            <Link href={href} className="nav-link">{label}</Link>
        </li>
    });
    
    const welcome_message = currentUser? `welcome ${currentUser.email}` : '' 
    // const links = currentUser? <div><Link href='/api/users/signout'>signout</Link></div> : <div><Link href='/'>signin or register</Link></div> 
    return(
        <div>
        <nav className="navbar navbar-light bg-light">
            <a href="/"><h1>AiChatWar Header </h1></a>
            <div className="d-flex justify-content-end">
                <ul className="nav d-flex align-items-center">
                {userLinks}
                </ul>

            </div>
            {/* {userLinks} */}
        </nav>
          
        <h2>{welcome_message}</h2>
        </div>
        )};