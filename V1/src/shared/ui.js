export function getDetailedUI(title, message) {
    return `(function()
    local t, m = [=[${title}]=], [=[${message}]=]
    pcall(function()
        local sg = Instance.new("ScreenGui")
        sg.Name = "maxitomError"
        sg.ResetOnSpawn = false
        sg.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
        local f = Instance.new("Frame")
        f.Size = UDim2.new(0, 460, 0, 280)
        f.Position = UDim2.new(0.5, -230, 0.5, -140)
        f.BackgroundColor3 = Color3.fromRGB(12, 12, 12)
        f.BorderSizePixel = 0
        f.Parent = sg
        Instance.new("UICorner", f).CornerRadius = UDim.new(0, 10)
        local stroke = Instance.new("UIStroke", f)
        stroke.Color = Color3.fromRGB(40, 40, 40)
        stroke.Thickness = 1
        local title = Instance.new("TextLabel", f)
        title.Size = UDim2.new(1, -40, 0, 50)
        title.Position = UDim2.new(0, 20, 0, 5)
        title.BackgroundTransparency = 1
        title.Text = t
        title.TextColor3 = Color3.fromRGB(255, 70, 70)
        title.TextSize = 20
        title.Font = Enum.Font.GothamBold
        title.TextXAlignment = Enum.TextXAlignment.Left
        local scroll = Instance.new("ScrollingFrame", f)
        scroll.Size = UDim2.new(1, -40, 1, -120)
        scroll.Position = UDim2.new(0, 20, 0, 60)
        scroll.BackgroundTransparency = 1
        scroll.BorderSizePixel = 0
        scroll.CanvasSize = UDim2.new(0, 0, 0, 0)
        scroll.AutomaticCanvasSize = Enum.AutomaticSize.Y
        scroll.ScrollBarThickness = 3
        scroll.ScrollBarImageColor3 = Color3.fromRGB(50, 50, 50)
        local msg = Instance.new("TextLabel", scroll)
        msg.Size = UDim2.new(1, 0, 0, 0)
        msg.AutomaticSize = Enum.AutomaticSize.Y
        msg.BackgroundTransparency = 1
        msg.Text = m
        msg.TextColor3 = Color3.fromRGB(180, 180, 180)
        msg.TextSize = 14
        msg.Font = Enum.Font.Code
        msg.TextWrapped = true
        msg.TextXAlignment = Enum.TextXAlignment.Left
        msg.TextYAlignment = Enum.TextYAlignment.Top
        local close = Instance.new("TextButton", f)
        close.Size = UDim2.new(0, 110, 0, 38)
        close.Position = UDim2.new(1, -130, 1, -50)
        close.BackgroundColor3 = Color3.fromRGB(22, 22, 22)
        close.Text = "Dismiss"
        close.TextColor3 = Color3.fromRGB(255, 255, 255)
        close.Font = Enum.Font.GothamMedium
        close.TextSize = 14
        Instance.new("UICorner", close).CornerRadius = UDim.new(0, 8)
        local bStroke = Instance.new("UIStroke", close)
        bStroke.Color = Color3.fromRGB(45, 45, 45)
        close.MouseButton1Click:Connect(function() sg:Destroy() end)
        sg.Parent = (gethui and gethui()) or (game:GetService("CoreGui")) or (game:GetService("Players").LocalPlayer:WaitForChild("PlayerGui"))
    end)
end)()`;
}
