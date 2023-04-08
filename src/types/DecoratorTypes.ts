export type ConstructorType<T> = new (...args : any[]) => T;
export type ClassDecoratorEx<T> = (
    target: ConstructorType<T>,
) => void;

export type PropertyDecorator = (
    target: Record<string, any>,
    propertyKey: string,
) => void;

export type MethodDecoratorEx = <T>(
    target: Record<string, any>,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<T>,
) => void;

export type ParameterDecoratorEx = (
    target: any,
    propertyKey: string,
    parameterIndex: number,
) => void;
