import axios from "axios";
import chatClient from "../utils/chatClient";

const HomePage = ({currentUser})=>{

    const pishiStr = currentUser? "Pishie Home logged in" : "Pishi home not sgined in!";
    return <h1>{pishiStr}</h1>
}

HomePage.getInitialProps = async (context)=>{
    const client = chatClient(context)
    const { data } = await client.get('/api/users/currentuser');
    return data

}

export default HomePage