export type ClassDecoratorEx = (
    target: Record<string, any>,
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
    target: Record<string, any>,
    propertyKey: string,
    parameterIndex: number,
) => void;
