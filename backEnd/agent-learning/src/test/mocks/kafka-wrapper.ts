export const mockKafkaWrapper = {
    producer: {
        send: jest.fn().mockResolvedValue(undefined)
    }
};

