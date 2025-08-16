import { useState } from "react";
import axios from "axios";

const requestTemplate  = ({url, method, body, onSuccess}) => {

    const [errors, setErrors] = useState(null)
    const sendRequest = async () => {

        try{
            setErrors(null);
            const respone = await axios[method](url, body);
            if(onSuccess){
                onSuccess(respone.data);
            }
            return respone.data

        }catch(err){
            setErrors(

                <div className="alert alert-danger">
                <h4>Error</h4>
                <ul className="my-0">
                {err.response.data.errors.map(err=><li key={err.message}>{err.message}</li>)}
                </ul>
                </div>
            )

        }
    }
    return { sendRequest, errors}
};

module.exports = requestTemplate