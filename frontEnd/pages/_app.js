import 'bootstrap/dist/css/bootstrap.css';
import chatClient from '../utils/chatClient';
import Header from '../components/header.';

const AppComponent  = ({Component, homePageData, currentUser})=>{
    return (<div>
        <Header currentUser={currentUser} />
        <Component {...homePageData} />
        </div>);

};

 AppComponent.getInitialProps = async (appContext)=>{

    const client = chatClient(appContext.ctx)
    const { data } = await client.get('/api/users/currentuser');
    console.log(data)
    let homePageData = {};
    console.log(appContext)
    if (appContext.Component.getInitialProps){
    homePageData = await appContext.Component.getInitialProps(appContext.ctx)
    }
    
    console.log(homePageData)
    return {homePageData, currentUser:data.currentUser}

};

export default AppComponent;